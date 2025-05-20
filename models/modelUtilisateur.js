const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  prenom: String,
  nom: String,
  email: { type: String, required: true, unique: true },
  motDePasse: { type: String, required: true },
  resetToken: String,
  resetTokenExp: Date,
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
