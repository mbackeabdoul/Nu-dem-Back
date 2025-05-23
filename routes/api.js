const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const User = require('../models/modelUtilisateur');
const jwt = require('jsonwebtoken');
const { jsPDF } = require('jspdf');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { sendTicketEmail } = require('../services/emailService');

const flights = [
  { id: 1, departure: 'Dakar', arrival: 'Paris', date: '2025-06-01T10:00:00Z', price: 300000, airline: 'Air Senegal', flightNumber: 'SN123' },
  { id: 2, departure: 'Dakar', arrival: 'New York', date: '2025-06-02T12:00:00Z', price: 500000, airline: 'Air Senegal', flightNumber: 'SN456' },
];

router.get('/flights', (req, res) => {
  const { departure, arrival, date } = req.query;
  const filteredFlights = flights.filter(
    (flight) =>
      (!departure || flight.departure.toLowerCase().includes(departure.toLowerCase())) &&
      (!arrival || flight.arrival.toLowerCase().includes(arrival.toLowerCase())) &&
      (!date || flight.date.startsWith(date))
  );
  res.json(filteredFlights.map(flight => ({
    ...flight,
    departureDateTime: new Date(flight.date).toISOString(),
  })));
});

router.get('/flights/:id', (req, res) => {
  const flight = flights.find((f) => f.id === parseInt(req.params.id));
  if (!flight) return res.status(404).json({ error: 'Vol non trouvé' });
  const departureDateTime = new Date(flight.date);
  if (isNaN(departureDateTime.getTime())) {
    console.error('Invalid date in flight:', flight);
    return res.status(500).json({ error: 'Date de vol invalide' });
  }
  res.json({
    ...flight,
    departureDateTime: departureDateTime.toISOString(),
  });
});

router.post('/bookings', async (req, res) => {
  try {
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
    console.log('Création réservation:', req.body);
    const requiredFields = ['customerName', 'customerEmail', 'customerPhone', 'departure', 'arrival', 'price', 'paymentMethod', 'departureDateTime'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return res.status(400).json({ error: `Le champ ${field} est requis` });
      }
    }
    const departureDateTime = new Date(req.body.departureDateTime);
    if (isNaN(departureDateTime.getTime())) {
      return res.status(400).json({ error: 'Format de date invalide pour departureDateTime' });
    }
    const booking = new Booking({
      ...req.body,
      userId,
      ticketNumber: `TKT-${Date.now()}`,
      ticketToken: crypto.randomBytes(16).toString('hex'),
      paymentStatus: 'pending',
      departureDateTime,
      emailSent: false,
    });
    await booking.save();
    console.log(`Réservation créée: ${booking.ticketNumber}`);
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
});

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
    if (!booking.emailSent) {
      console.log(`Ticket download blocked for ${booking.ticketNumber}: email not sent`);
      return res.status(403).json({ error: 'Billet non disponible, email non envoyé' });
    }

    const doc = new jsPDF();
    doc.setFillColor(51, 103, 214);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('BILLET ÉLECTRONIQUE', 105, 15, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Passager: ${booking.customerName}`, 20, 50);
    doc.text(`Vol: ${booking.flightNumber}`, 20, 60);
    doc.text(`Compagnie: ${booking.airline}`, 20, 70);
    doc.text(`Départ: ${booking.departure}`, 20, 80);
    doc.text(`Arrivée: ${booking.arrival}`, 20, 90);
    doc.text(`Date: ${new Date(booking.departureDateTime).toLocaleString('fr-FR')}`, 20, 100);
    doc.text(`Prix: ${booking.price} XOF`, 20, 110);
    doc.text(`Numéro de billet: ${booking.ticketNumber}`, 20, 120);
    doc.text(`QR:${booking.ticketNumber}:${booking.ticketToken}`, 160, 115, { align: 'center' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=billet-${booking.ticketNumber}.pdf`);
    res.send(Buffer.from(doc.output('arraybuffer')));
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

router.post('/payments', async (req, res) => {
  try {
    const { bookingId, paymentMethod } = req.body;
    if (!bookingId || !paymentMethod) {
      return res.status(400).json({ error: 'Données de paiement incomplètes' });
    }
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: 'Réservation non trouvée' });
    booking.paymentStatus = 'completed';
    await booking.save();
    res.json({ success: true, bookingId, paymentMethod });
  } catch (err) {
    console.error('Erreur paiement:', err);
    res.status(500).json({ error: 'Erreur lors du paiement' });
  }
});
// / Inscription
// Inscription (/api/auth/inscription)
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

// Connexion (/api/auth/connexion)
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

module.exports = router;