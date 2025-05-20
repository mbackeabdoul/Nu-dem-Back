const User = require('./../models/modelUtilisateur');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

exports.inscription = async (req, res) => {
  const { prenom, nom, email, motDePasse } = req.body;

  if (!prenom || !nom || !email || !motDePasse) {
    return res.status(400).json({ message: "Tous les champs sont requis." });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "Email déjà utilisé." });
  }

  const hashedPassword = await bcrypt.hash(motDePasse, 10);

  const newUser = new User({
    prenom,
    nom,
    email,
    motDePasse: hashedPassword
  });

  await newUser.save();

  res.status(201).json({ message: "Inscription réussie." });
};

exports.connexion = async (req, res) => {
  const { email, motDePasse } = req.body;
  const user = await User.findOne({ email });

  if (!user) return res.status(400).json({ message: "Utilisateur non trouvé." });

  const match = await bcrypt.compare(motDePasse, user.motDePasse);
  if (!match) return res.status(401).json({ message: "Mot de passe incorrect." });

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

  res.status(200).json({ message: "Connexion réussie.", token });
};

//pour le forgot password
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
}
//pour le reset password
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  const
    user = await User.findOne({
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
}
