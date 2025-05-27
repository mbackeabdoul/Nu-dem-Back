const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({
  departure: String,
  arrival: String,
  departureTime: Date,
  arrivalTime: Date,
  flightNumber: String,
  airline: String,
});

const bookingSchema = new mongoose.Schema({
  // Informations utilisateur
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  customerName: { type: String, required: true },
  customerEmail: { type: String, required: true },
  customerPhone: { type: String, required: true },
  
  // Informations générales du vol
  departure: { type: String, required: true },
  arrival: { type: String, required: true },
  airline: { type: String, required: true },
  flightNumber: { type: String, required: true },
  price: { type: Number, required: true },
  currency: { type: String, default: 'XOF' },
  
  // Type de voyage
  isRoundTrip: { type: Boolean, default: false },
  
  // Informations vol aller
  departureDateTime: { type: Date, required: true },
  arrivalDateTime: { type: Date, default: null },
  duration: { type: String, default: 'Non spécifié' },
  
  // Informations vol retour (si aller-retour)
  returnDepartureDateTime: { type: Date, default: null },
  returnArrivalDateTime: { type: Date, default: null },
  returnDuration: { type: String, default: null },
  
  // Segments détaillés
  segments: [segmentSchema],
  returnSegments: [segmentSchema],
  
  // Informations de siège et check-in
  seat: { type: String, default: 'Non assigné' },
  checkInTime: { type: Date, required: true },
  remainingSeats: { type: String, default: 'N/A' },
  
  // Informations de réservation
  ticketNumber: { type: String, required: true, unique: true },
  ticketToken: { type: String, required: true },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'completed', 'failed', 'cancelled'], 
    default: 'pending' 
  },
  paymentMethod: { 
    type: String, 
    enum: ['Wave', 'Orange Money', 'Carte bancaire'], 
    required: true 
  },
  
  // Email
  emailSent: { type: Boolean, default: false },
  
  // Métadonnées
  bookingStatus: { 
    type: String, 
    enum: ['confirmed', 'cancelled', 'completed'], 
    default: 'confirmed' 
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Middleware pour mettre à jour updatedAt
bookingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index pour améliorer les performances
bookingSchema.index({ userId: 1 });
bookingSchema.index({ ticketNumber: 1 });
bookingSchema.index({ customerEmail: 1 });
bookingSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Booking', bookingSchema);