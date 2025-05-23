const User = require('../models/modelUtilisateur');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendConfirmationEmail } = require('../services/emailService');

exports.inscription = async (req, res) => {
  const { prenom, nom, email, motDePasse } = req.body;

  console.log('Inscription appelée avec:', { prenom, nom, email });

  if (!prenom || !nom || !email || !motDePasse) {
    return res.status(400).json({ message: 'Tous les champs sont requis.' });
  }

  try {
    const normalizedEmail = email.toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'Email déjà utilisé.' });
    }

    const hashedPassword = await bcrypt.hash(motDePasse, 10);
    console.log('Mot de passe hashé:', hashedPassword);

    const newUser = new User({
      prenom,
      nom,
      email: normalizedEmail,
      motDePasse: hashedPassword,
    });

    await newUser.save();
    console.log('Utilisateur sauvegardé:', newUser);

    await sendConfirmationEmail(newUser);

    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(201).json({ message: 'Inscription réussie.', token, user: { prenom, nom, email: normalizedEmail } });
  } catch (err) {
    console.error('Erreur inscription:', err.message);
    res.status(500).json({ message: 'Erreur serveur lors de l’inscription.' });
  }
};

exports.connexion = async (req, res) => {
  const { email, motDePasse } = req.body;

  console.log('Connexion appelée avec:', { email });

  try {
    if (!email || !motDePasse) {
      return res.status(400).json({ message: 'Email et mot de passe requis.' });
    }
    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ message: 'Utilisateur non trouvé.' });
    }

    const match = await bcrypt.compare(motDePasse, user.motDePasse);
    if (!match) {
      return res.status(401).json({ message: 'Mot de passe incorrect.' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.status(200).json({
      message: 'Connexion réussie.',
      token,
      user: { prenom: user.prenom, nom: user.nom, email: user.email, _id: user._id },
    });
  } catch (err) {
    console.error('Erreur connexion:', err.message);
    res.status(500).json({ message: 'Erreur serveur lors de la connexion.' });
  }
};


exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Email non trouvé.' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    const expire = Date.now() + 3600000;
    user.resetToken = token;
    user.resetTokenExp = expire;
    await user.save();
    console.log(`Token pour réinitialisation : ${token}`);
    res.status(200).json({
      message: 'Lien de réinitialisation généré (voir console).',
      token,
    });
  } catch (err) {
    console.error('Erreur forgotPassword:', err.message);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExp: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ message: 'Token invalide ou expiré.' });
    }
    user.motDePasse = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined;
    user.resetTokenExp = undefined;
    await user.save();
    res.status(200).json({ message: 'Mot de passe mis à jour.' });
  } catch (err) {
    console.error('Erreur resetPassword:', err.message);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
};