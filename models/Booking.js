const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, required: true },
  departure: { type: String, required: true },
  arrival: { type: String, required: true },
  price: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  departureDateTime: { type: Date, required: true },
  arrivalDateTime: { type: Date, required: false }, // Optionnel
  duration: { type: String },
  seat: { type: String },
  checkInTime: { type: Date },
  remainingSeats: { type: String },
  userId: { type: String },
  ticketNumber: { type: String },
  ticketToken: { type: String },
  paymentStatus: { type: String },
  emailSent: { type: Boolean },
});

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;