const User = require('../models/modelUtilisateur');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

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
    // 1. Vérifier si l'utilisateur existe
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Email non trouvé.' });
    }

    // 2. Générer un token sécurisé
    const token = crypto.randomBytes(32).toString('hex');
    const expire = Date.now() + 3600000; // 1 heure

    // 3. Stocker le token et son expiration dans la base
    user.resetToken = token;
    user.resetTokenExp = expire;
    await user.save();

    // 4. Lien de réinitialisation (frontend)
    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;

    // 5. Configurer le mailer (tu peux utiliser Gmail ou autre service)
    const transporter = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: 'Réinitialisation de votre mot de passe',
      html: `
        <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
        <p>Cliquez sur ce lien pour définir un nouveau mot de passe :</p>
        <a href="${resetLink}">${resetLink}</a>
        <p>Ce lien expirera dans 1 heure.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: 'Un lien de réinitialisation a été envoyé à votre adresse email.',
    });

  } catch (err) {
    console.error('Erreur forgotPassword:', err.message);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    // 1. Trouver l'utilisateur avec le bon token non expiré
    const user = await User.findOne({
      resetToken: token,
      resetTokenExp: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: 'Lien invalide ou expiré.' });
    }

    // 2. Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 3. Mettre à jour le mot de passe
    user.motDePasse = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExp = undefined;

    await user.save();

    res.status(200).json({ message: 'Mot de passe réinitialisé avec succès.' });

  } catch (err) {
    console.error('Erreur resetPassword:', err.message);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
};