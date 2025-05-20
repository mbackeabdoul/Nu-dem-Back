const User = require('../models/modelUtilisateur');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

exports.forgotPassword = async (req, res) => {
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
};

exports.resetPassword = async (req, res) => {
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
};