const mongoose = require('mongoose');
const bookingSchema = new mongoose.Schema({
  customerName: String,
  customerEmail: String,
  customerPhone: String,
  departure: String,
  arrival: String,
  price: Number,
  airline: String,
  flightNumber: String,
  departureDateTime: Date,
  paymentMethod: String,
  userId: String,
  ticketNumber: String,
  ticketToken: String,
  paymentStatus: String,
  emailSent: { type: Boolean, default: false }, // Nouveau champ
});
module.exports = mongoose.model('Booking', bookingSchema);