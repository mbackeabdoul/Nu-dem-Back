const User = require('../models/modelUtilisateur');
const crypto = require('crypto');
const bcrypt = require('bcrypt');



// exports.resetPassword = async (req, res) => {
//   const { token, newPassword } = req.body;

//   const user = await User.findOne({
//     resetToken: token,
//     resetTokenExp: { $gt: Date.now() }
//   });

//   if (!user) {
//     return res.status(400).json({ message: "Token invalide ou expiré." });
//   }

//   user.motDePasse = await bcrypt.hash(newPassword, 10);
//   user.resetToken = undefined;
//   user.resetTokenExp = undefined;
//   await user.save();

//   res.status(200).json({ message: "Mot de passe mis à jour." });
// };