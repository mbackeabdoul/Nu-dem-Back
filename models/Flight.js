const mongoose = require('mongoose');

const flightSchema = new mongoose.Schema({
  flightNumber: { type: String, required: true },
  departure: { type: String, required: true },
  arrival: { type: String, required: true },
  departureTime: { type: String, required: true }, // ISO format, e.g., "2025-05-25T10:00:00"
  arrivalTime: { type: String, required: true },   // ISO format
  duration: { type: String, required: true },      // e.g., "8h 0m"
  price: { type: Number, required: true },
  currency: { type: String, default: 'EUR' },
  airline: { type: String, required: true },
  stops: { type: Number, default: 0 },
  stopLocations: [{ type: String }],               // e.g., ["LON"]
  direct: { type: Boolean, default: true },
  availableSeats: { type: Number, required: true },
  cabinClass: { type: String, default: 'ECONOMY' },
  refundable: { type: Boolean, default: false },
  segments: [{
    departureAirport: String,
    arrivalAirport: String,
    departureTime: String,
    arrivalTime: String,
    duration: String,
    carrierCode: String,
    flightNumber: String,
  }],
});

module.exports = mongoose.model('Flight', flightSchema);