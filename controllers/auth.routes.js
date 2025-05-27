const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');
const reset = require('../controllers/reset.controller');
const { sendConfirmationEmail } = require('../services/emailService');

router.post('/inscription', async (req, res) => {
  try {
    const result = await auth.inscription(req, res);
    if (result.status === 201) {
      const { email, prenom } = req.body;
      const user = { email, prenom };
      await sendConfirmationEmail(user);
    }
    return result;
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/connexion', auth.connexion);

router.post('/reset-password', reset.resetPassword);

module.exports = router;