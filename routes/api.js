const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');

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

module.exports = router;