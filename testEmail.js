require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.sendMail({
  from: 'Ñu Dem <no-reply@nudem.com>',
  to: 'khoudossmbacke2000@gmail.com',
  subject: 'Test Ñu Dem',
  text: 'Jàmm ak jàmm ! Test email.',
})
  .then(() => console.log('Email envoyé'))
  .catch(err => console.error('Erreur:', err.message));