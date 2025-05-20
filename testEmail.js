const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.sendMail({
  from: 'Ñu Dem <no-reply@nudem.com>',
  to: 'khoudossmbacke18@gmail.com',
  subject: 'Test Email',
  text: 'Jàmm ak jàmm ! Ceci est un test de Ñu Dem.',
}).then(() => console.log('Email envoyé'))
  .catch(err => console.error('Erreur:', err));