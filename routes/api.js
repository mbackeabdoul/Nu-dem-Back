const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Amadeus = require('amadeus'); // Ajoute cette ligne
const User = require('../models/modelUtilisateur');
const jwt = require('jsonwebtoken');
const { jsPDF } = require('jspdf');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const axios = require('axios');
const { sendTicketEmail, sendConfirmationEmail } = require('../services/emailService');
const {forgotPassword, resetPassword} = require('../controllers/auth.controller'); // Assurez-vous que le chemin est correct

// Gestion du token Amadeus
// Gestion du token Amadeus (déjà défini)
let amadeusToken = null;
let tokenExpiresAt = null;

const getAmadeusToken = async () => {
  if (amadeusToken && tokenExpiresAt > Date.now()) {
    return amadeusToken;
  }
  try {
    const tokenUrl = `${process.env.AMADEUS_BASE_URL}/v1/security/oauth2/token`;
    console.log('AMADEUS_BASE_URL:', process.env.AMADEUS_BASE_URL);
    console.log('Token URL:', tokenUrl);
    if (!process.env.AMADEUS_BASE_URL) {
      throw new Error('AMADEUS_BASE_URL non défini dans .env');
    }
    const response = await axios.post(
      tokenUrl,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: process.env.AMADEUS_API_KEY,
        client_secret: process.env.AMADEUS_API_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    amadeusToken = response.data.access_token;
    tokenExpiresAt = Date.now() + (response.data.expires_in * 1000 - 60000);
    console.log('Token Amadeus généré:', amadeusToken.substring(0, 10) + '...');
    return amadeusToken;
  } catch (err) {
    console.error('Erreur génération token Amadeus:', err.message, err.stack);
    throw new Error('Impossible de générer le token Amadeus');
  }
};

// Route pour autocomplétion des villes
router.get('/cities', async (req, res) => {
  try {
    const { keyword } = req.query;
    console.log(`Requête /cities:`, { keyword });

    // Validation du mot-clé
    if (!keyword || keyword.length < 3) {
      return res.status(400).json({ error: 'Le mot-clé doit contenir au moins 3 caractères' });
    }

    // Utilise le token généré
    const token = await getAmadeusToken();
    const response = await axios.get(
      `${process.env.AMADEUS_BASE_URL}/v1/reference-data/locations/cities`,
      {
        params: {
          keyword: keyword,
          max: 10, // Limite le nombre de résultats
        },
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const cities = response.data.data.map(city => ({
      name: city.name,
      iataCode: city.iataCode,
      cityCode: city.iataCode,
    }));

    console.log('Villes trouvées:', cities);
    res.json(cities);
  } catch (error) {
    console.error('Erreur recherche villes:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.errors?.[0]?.detail || error.message || 'Erreur lors de la recherche des villes',
    });
  }
});

// Route pour rechercher les vols
// Route pour rechercher des vols (aller simple ou aller-retour)
router.get('/flights', async (req, res) => {
  try {
    // On récupère aussi returnDate et tripType
    const {
      departure,
      arrival,
      date,
      returnDate,
      passengers = 1,
      tripType = 'oneway'
    } = req.query;

    console.log('Requête /flights:', { departure, arrival, date, returnDate, passengers, tripType });

    // 1. Validation des champs obligatoires
    if (!departure || !arrival || !date) {
      return res.status(400).json({ error: 'Départ, arrivée et date de départ requis' });
    }
    if (tripType === 'roundtrip' && !returnDate) {
      return res.status(400).json({ error: 'La date de retour est requise pour un aller-retour' });
    }

    // 2. Validation des codes IATA
    const iataCodeRegex = /^[A-Z]{3}$/;
    if (!iataCodeRegex.test(departure) || !iataCodeRegex.test(arrival)) {
      return res.status(400).json({ error: 'Codes IATA invalides' });
    }

    // 3. Récupération du token Amadeus
    const token = await getAmadeusToken();

    // 4. Construction des paramètres pour Amadeus
    const params = {
      originLocationCode: departure,
      destinationLocationCode: arrival,
      departureDate: date,
      adults: parseInt(passengers),
      max: 10,
    };
    // Si aller-retour, on ajoute returnDate
    if (tripType === 'roundtrip') {
      params.returnDate = returnDate;
    }

    // 5. Appel à l'API Amadeus
    const response = await axios.get(
      `${process.env.AMADEUS_BASE_URL}/v2/shopping/flight-offers`,
      {
        params,
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    // 6. Transformation de la réponse
    const flights = response.data.data.map(flight => {

      const itineraries = flight.itineraries;

      // Segments du vol aller
      const outboundSegments = itineraries[0].segments;
      const lastOutboundSegment = outboundSegments[outboundSegments.length - 1];

      // Segments du vol retour (si aller-retour)
      const returnSegments = itineraries[1]?.segments || [];
      const lastReturnSegment = returnSegments.length > 0 ? returnSegments[returnSegments.length - 1] : null;


      // Structure du vol
      return {
        id: flight.id,
        departure: outboundSegments[0].departure.iataCode,
        departureName:
          response.data.dictionaries.locations[outboundSegments[0].departure.iataCode]?.cityName || 'Unknown',
        arrival: lastOutboundSegment.arrival.iataCode,
        arrivalName:
          response.data.dictionaries.locations[lastOutboundSegment.arrival.iataCode]?.cityName || 'Unknown',
      
        departureDateTime: outboundSegments[0].departure.at,
        arrivalDateTime: lastOutboundSegment.arrival.at,
      
        returnDepartureDateTime: returnSegments[0]?.departure.at || null,
        returnArrivalDateTime: lastReturnSegment?.arrival.at || null,
      
        price: parseFloat(flight.price.grandTotal),
        currency: flight.price.currency,
      
        airline:
          response.data.dictionaries.carriers[flight.validatingAirlineCodes[0]] || 'Unknown',
        flightNumber: outboundSegments[0].number,
      
        duration: flight.itineraries[0].duration,
        returnDuration: flight.itineraries[1]?.duration || null,
      
        segments: outboundSegments.map(seg => ({
          departure: seg.departure.iataCode,
          arrival: seg.arrival.iataCode,
          departureTime: seg.departure.at,
          arrivalTime: seg.arrival.at,
          flightNumber: seg.number,
          airline: seg.carrierCode,
        })),
      
        returnSegments: returnSegments.map(seg => ({
          departure: seg.departure.iataCode,
          arrival: seg.arrival.iataCode,
          departureTime: seg.departure.at,
          arrivalTime: seg.arrival.at,
          flightNumber: seg.number,
          airline: seg.carrierCode,
        })),
      
        isDirect: outboundSegments.length === 1 && returnSegments.length <= 1,
        remainingSeats: flight.numberOfBookableSeats || 'Unknown',
      };
    
    });

    console.log(`Vols trouvés: ${flights.length} résultats`);
    return res.json(flights);

  } catch (err) {
    // Gestion des erreurs et log détaillé
    console.error('Erreur recherche vols:', {
      message: err.message,
      status: err.response?.status,
      data: err.response?.data,
    });
    return res
      .status(500)
      .json({
        error: 'Erreur lors de la recherche de vols',
        details: err.response?.data || err.message,
      });
  }
});


router.post('/bookings', async (req, res) => {
  try {
    // ... code existant pour l'authentification ...
    const token = req.headers.authorization?.split(' ')[1];
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.userId;
      } catch (err) {
        console.error('Erreur vérification token:', err.message);
        return res.status(401).json({ error: 'Token invalide ou expiré' });
      }
    }
    // Champs obligatoires de base
    const requiredFields = ['customerName', 'customerEmail', 'customerPhone', 'departure', 'arrival', 'price', 'paymentMethod', 'departureDateTime', 'seat', 'checkInTime'];
    
    // Si c'est un aller-retour, ajouter les champs retour obligatoires
    if (req.body.isRoundTrip) {
      requiredFields.push('returnDepartureDateTime');
    }

    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ error: `Le champ ${field} est requis` });
      }
    }

    // Validation des dates aller
    const departureDateTime = new Date(req.body.departureDateTime);
    const checkInTime = new Date(req.body.checkInTime);
    
    if (isNaN(departureDateTime.getTime()) || isNaN(checkInTime.getTime())) {
      return res.status(400).json({ error: 'Format de date invalide' });
    }

    // Validation des dates retour si aller-retour
    let returnDepartureDateTime = null;
    let returnArrivalDateTime = null;
    
    if (req.body.isRoundTrip) {
      returnDepartureDateTime = new Date(req.body.returnDepartureDateTime);
      if (isNaN(returnDepartureDateTime.getTime())) {
        return res.status(400).json({ error: 'Format de date de retour invalide' });
      }
      
      if (req.body.returnArrivalDateTime) {
        returnArrivalDateTime = new Date(req.body.returnArrivalDateTime);
        if (isNaN(returnArrivalDateTime.getTime())) {
          return res.status(400).json({ error: 'Format de date d\'arrivée retour invalide' });
        }
      }
    }
 
    const booking = new Booking({
      ...req.body,
      userId,
      ticketNumber: `TKT-${Date.now()}`,
      ticketToken: crypto.randomBytes(16).toString('hex'),
      paymentStatus: 'completed',
      
      // Dates aller
      departureDateTime,
      checkInTime,
      
      // Dates retour (si applicable)
      returnDepartureDateTime,
      returnArrivalDateTime,
      
      emailSent: false,
    });
 
    await booking.save();
    console.log(`Réservation créée: ${booking.ticketNumber} - ${req.body.isRoundTrip ? 'Aller-Retour' : 'Aller Simple'}`);
 
    try {
      await sendTicketEmail(booking);
      booking.emailSent = true;
      await booking.save();
      console.log(`Email envoyé pour ${booking.ticketNumber}`);
    } catch (emailErr) {
      console.error('Erreur envoi email pour réservation:', emailErr.message);
    }
 
    res.status(201).json(booking);
  } catch (err) {
    console.error('Erreur création réservation:', err.message);
    res.status(400).json({ error: err.message || 'Erreur lors de la création de la réservation' });
  }
 })



// Routes existantes (réservations, auth, etc.)
// router.post('/bookings', async (req, res) => {
//   try {
//     const token = req.headers.authorization?.split(' ')[1];
//     let userId = null;
//     if (token) {
//       try {
//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         userId = decoded.userId;
//       } catch (err) {
//         console.error('Erreur vérification token:', err.message);
//         return res.status(401).json({ error: 'Token invalide ou expiré' });
//       }
//     }
//     console.log('Création réservation:', req.body);
//     const requiredFields = ['customerName', 'customerEmail', 'customerPhone', 'departure', 'arrival', 'price', 'paymentMethod', 'departureDateTime', 'seat', 'checkInTime'];
//     for (const field of requiredFields) {
//       if (!req.body[field]) {
//         return res.status(400).json({ error: `Le champ ${field} est requis` });
//       }
//     }
//     const departureDateTime = new Date(req.body.departureDateTime);
//     const checkInTime = new Date(req.body.checkInTime);
//     if (isNaN(departureDateTime.getTime()) || isNaN(checkInTime.getTime())) {
//       return res.status(400).json({ error: 'Format de date invalide' });
//     }
//     const booking = new Booking({
//       ...req.body,
//       userId,
//       ticketNumber: `TKT-${Date.now()}`,
//       ticketToken: crypto.randomBytes(16).toString('hex'), // Généré côté serveur
//       paymentStatus: 'pending',
//       departureDateTime,
//       checkInTime,
//       emailSent: false,
//     });
//     await booking.save();
//     console.log(`Réservation créée: ${booking.ticketNumber}`);
//     try {
//       await sendTicketEmail(booking);
//       booking.emailSent = true;
//       await booking.save();
//       console.log(`Email envoyé pour ${booking.ticketNumber}`);
//     } catch (emailErr) {
//       console.error('Erreur envoi email pour réservation:', emailErr.message);
//     }
//     res.status(201).json(booking);
//   } catch (err) {
//     console.error('Erreur création réservation:', err.message);
//     res.status(400).json({ error: err.message || 'Erreur lors de la création de la réservation' });
//   }
// });




router.get('/bookings', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    let bookings;
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      bookings = await Booking.find({ userId: decoded.userId });
    } else {
      bookings = await Booking.find();
    }
    res.json(bookings);
  } catch (err) {
    console.error('Erreur récupération réservations:', err);
    res.status(500).json({ error: err.message });
  }
});



router.post('/get-booking-by-ticket', async (req, res) => {
  try {
    const { ticketNumber, customerEmail } = req.body;
    const booking = await Booking.findOne({ ticketNumber, customerEmail });
    if (!booking) return res.status(404).json({ error: 'Réservation non trouvée' });
    res.json(booking);
  } catch (err) {
    console.error('Erreur récupération réservation par billet:', err);
    res.status(500).json({ error: err.message });
  }
});



router.delete('/bookings/:id', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Réservation non trouvée' });
    res.json({ message: 'Réservation annulée' });
  } catch (err) {
    console.error('Erreur annulation réservation:', err);
    res.status(500).json({ error: err.message });
  }
});



router.get('/generate-ticket/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ error: 'Réservation non trouvée' });
    const { generateTicketPDF } = require('../services/emailService');
    const pdfBuffer = await generateTicketPDF(booking);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=billet-${booking.ticketNumber}.pdf`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Erreur génération PDF:', err);
    res.status(500).json({ error: 'Erreur lors de la génération du billet' });
  }
});



router.post('/send-ticket-email/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) {
      console.error(`Booking not found: ${req.params.bookingId}`);
      return res.status(404).json({ error: 'Réservation non trouvée' });
    }
    console.log(`Sending ticket email for booking ${booking.ticketNumber}`);
    await sendTicketEmail(booking);
    booking.emailSent = true;
    await booking.save();
    console.log(`Email sent and booking updated: ${booking.ticketNumber}`);
    res.status(200).json({ message: 'E-mail envoyé avec succès' });
  } catch (err) {
    console.error('Erreur lors de l’envoi de l’e-mail:', err);
    res.status(500).json({ error: 'Erreur lors de l’envoi de l’e-mail' });
  }
});



router.post('/send-confirmation-email', async (req, res) => {
  try {
    const { email, prenom } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    await sendConfirmationEmail(user);
    res.status(200).json({ message: 'E-mail de confirmation envoyé avec succès' });
  } catch (err) {
    console.error('Erreur lors de l’envoi de l’e-mail de confirmation:', err);
    res.status(500).json({ error: 'Erreur lors de l’envoi de l’e-mail' });
  }
});



router.get('/verify-ticket/:ticketNumber', async (req, res) => {
  try {
    const { ticketNumber } = req.params;
    const { token } = req.query;
    const booking = await Booking.findOne({ ticketNumber, ticketToken: token });
    if (!booking) return res.status(404).json({ error: 'Billet non trouvé ou token invalide' });
    res.json({
      customerName: booking.customerName,
      departure: booking.departure,
      arrival: booking.arrival,
      flightNumber: booking.flightNumber,
      departureDateTime: booking.departureDateTime,
      paymentStatus: booking.paymentStatus,
    });
  } catch (err) {
    console.error('Erreur vérification billet:', err);
    res.status(500).json({ error: 'Erreur lors de la vérification du billet' });
  }
});




// router.post('/payments', async (req, res) => {
//   try {
//     const { bookingId, paymentMethod } = req.body;
//     if (!bookingId || !paymentMethod) {
//       return res.status(400).json({ error: 'Données de paiement incomplètes' });
//     }
//     const booking = await Booking.findById(bookingId);
//     if (!booking) return res.status(404).json({ error: 'Réservation non trouvée' });
//     booking.paymentStatus = 'completed';
//     await booking.save();
//     res.json({ success: true, bookingId, paymentMethod });
//   } catch (err) {
//     console.error('Erreur paiement:', err);
//     res.status(500).json({ error: 'Erreur lors du paiement' });
//   }
// });



router.post('/auth/inscription', async (req, res) => {
  try {
    const { prenom, nom, email, motDePasse } = req.body;
    console.log(`Inscription /auth: ${email}`);
    if (!prenom || !nom || !email || !motDePasse) {
      return res.status(400).json({ error: 'Tous les champs sont requis' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email déjà utilisé' });
    }
    const hashedPassword = await bcrypt.hash(motDePasse, 10);
    console.log('Mot de passe hashé:', hashedPassword);
    const user = new User({ prenom, nom, email, motDePasse: hashedPassword });
    await user.save();
    console.log('Utilisateur sauvegardé:', user);
    await sendConfirmationEmail(user);
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ message: 'Inscription réussie.', token, user: { prenom, nom, email } });
  } catch (err) {
    console.error('Erreur inscription /auth:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/auth/connexion', async (req, res) => {
  try {
    const { email, motDePasse } = req.body;
    console.log(`Connexion /auth: ${email}`);
    if (!email || !motDePasse) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Utilisateur non trouvé' });
    }
    const match = await bcrypt.compare(motDePasse, user.motDePasse);
    if (!match) {
      return res.status(401).json({ error: 'Mot de passe incorrect' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ message: 'Connexion réussie.', token, user: { prenom: user.prenom, nom: user.nom, email } });
  } catch (err) {
    console.error('Erreur connexion /auth:', err.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/forgot-password' , forgotPassword); 
router.post('/reset-password' , resetPassword); 


module.exports = router;
