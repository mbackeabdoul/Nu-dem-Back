//Nu-dem-Back/models/modelUtilisateur.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  prenom: { type: String, required: true },
  nom: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  motDePasse: { type: String, required: true },
  resetToken: String,
  resetTokenExp: Date,
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);