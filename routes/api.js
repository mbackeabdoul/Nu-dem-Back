const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const User = require('../models/modelUtilisateur');
const bcrypt = require('bcrypt');
// Simulated flight data
const flights = [
  { id: 1, departure: 'Paris', arrival: 'New York', date: '2025-06-01', price: 299 },
  { id: 2, departure: 'Paris', arrival: 'Tokyo', date: '2025-06-02', price: 499 },
  // Add more as needed
];

// Search flights
router.get('/flights', (req, res) => {
  const { departure, arrival, date } = req.query;
  const filteredFlights = flights.filter(
    (flight) =>
      (!departure || flight.departure.toLowerCase().includes(departure.toLowerCase())) &&
      (!arrival || flight.arrival.toLowerCase().includes(arrival.toLowerCase())) &&
      (!date || flight.date === date)
  );
  res.json(filteredFlights);
});

// Create booking
router.post('/bookings', async (req, res) => {
  try {
    const booking = new Booking(req.body);
    await booking.save();
    res.status(201).json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get all bookings
router.get('/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cancel booking
router.delete('/bookings/:id', async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//route de l'inscription
router.post('/inscription', async (req, res) => {
  const { prenom, nom, email, motDePasse } = req.body;

  if (!prenom || !nom || !email || !motDePasse) {
    return res.status(400).json({ message: "Tous les champs sont requis." });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "Email déjà utilisé." });
  }

  const hashedPassword = await bcrypt.hash(motDePasse, 10);

  const newUser = new User({
    prenom,
    nom,
    email,
    motDePasse: hashedPassword
  });

  await newUser.save();

  res.status(201).json({ message: "Inscription réussie." });
});
//route de la connexion
router.post('/connexion', async (req, res) => {
  const { email, motDePasse } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "Utilisateur non trouvé." });
  const match = await bcrypt.compare(motDePasse, user.motDePasse);
  if (!match) return res.status(401).json({ message: "Mot de passe incorrect." });
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.status(200).json({ message: "Connexion réussie.", token });
}
);
//route de la réinitialisation de mot de passe
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: "Email non trouvé." });
  } 
  const token = crypto.randomBytes(32).toString("hex");
  const expire = Date.now() + 3600000; // 1 heure
  user.resetToken = token;
  user.resetTokenExp = expire;
  await user.save();
  // Affiche le token dans la réponse (pas d'email)
  console.log(`Token pour réinitialisation : ${token}`);
  res.status(200).json({
    message: "Lien de réinitialisation généré (voir console).",
    token // à envoyer au front-end
  });
}
);
//route de la mise à jour du mot de passe
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  const user = await User.findOne({
    resetToken: token,
    resetTokenExp: { $gt: Date.now() }
  });
  if (!user) {
    return res.status(400).json({ message: "Token invalide ou expiré." });
  }
  user.motDePasse = await bcrypt.hash(newPassword, 10);
  user.resetToken = undefined;
  user.resetTokenExp = undefined;
  await user.save();
  res.status(200).json({ message: "Mot de passe mis à jour." });
}
);

module.exports = router;