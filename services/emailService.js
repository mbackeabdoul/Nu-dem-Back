const nodemailer = require('nodemailer');
const { jsPDF } = require('jspdf');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const generateTicketPDF = (booking) => {
  const doc = new jsPDF();
  doc.setFillColor(51, 103, 214);
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('BILLET ÉLECTRONIQUE', 105, 15, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Passager: ${booking.customerName || 'N/A'}`, 20, 50);
  doc.text(`Vol: ${booking.flightNumber || 'N/A'}`, 20, 60);
  doc.text(`Compagnie: ${booking.airline || 'N/A'}`, 20, 70);
  doc.text(`Départ: ${booking.departure || 'N/A'}`, 20, 80);
  doc.text(`Arrivée: ${booking.arrival || 'N/A'}`, 20, 90);
  doc.text(`Date: ${booking.departureDateTime ? new Date(booking.departureDateTime).toLocaleString('fr-FR') : 'N/A'}`, 20, 100);
  doc.text(`Prix: ${booking.price ? booking.price + ' XOF' : 'N/A'}`, 20, 110);
  doc.text(`Numéro de billet: ${booking.ticketNumber || 'N/A'}`, 20, 120);
  doc.text(`QR:${booking.ticketNumber || 'N/A'}:${booking.ticketToken || 'N/A'}`, 160, 115, { align: 'center' });
  return Buffer.from(doc.output('arraybuffer'));
};

const sendTicketEmail = async (booking) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      throw new Error('Identifiants email manquants dans .env');
    }
    if (!booking.customerEmail) {
      throw new Error('Email du client manquant');
    }
    console.log(`Envoi email à : ${booking.customerEmail}`);
    const pdfBuffer = generateTicketPDF(booking);
    const downloadLink = `http://localhost:5000/api/generate-ticket/${booking._id}`;
    const mailOptions = {
      from: 'Ñu Dem <no-reply@nudem.com>',
      to: booking.customerEmail,
      subject: `Votre billet pour ${booking.departure || 'N/A'} → ${booking.arrival || 'N/A'}`,
      html: `
        <h2>Bonjour ${booking.customerName || 'Client'},</h2>
        <p>Jàmm ak jàmm ! Votre billet est en pièce jointe.</p>
        <p><strong>Numéro de billet :</strong> ${booking.ticketNumber || 'N/A'}</p>
        <p><strong>Date de départ :</strong> ${booking.departureDateTime ? new Date(booking.departureDateTime).toLocaleString('fr-FR') : 'N/A'}</p>
        <p><strong>Compagnie :</strong> ${booking.airline || 'N/A'}</p>
        <p><strong>Vol :</strong> ${booking.flightNumber || 'N/A'}</p>
        <p><strong>Prix :</strong> ${booking.price ? booking.price + ' XOF' : 'N/A'}</p>
        <p><a href="${downloadLink}">Télécharger votre billet</a></p>
        <p>Présentez ce billet à l’embarquement.</p>
        <p>Bon voyage !</p>
      `,
      attachments: [
        {
          filename: `billet-${booking.ticketNumber || 'inconnu'}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };
    await transporter.sendMail(mailOptions);
    console.log(`Email envoyé à ${booking.customerEmail}`);
  } catch (err) {
    console.error('Erreur envoi email:', err.message);
    throw err;
  }
};

const sendConfirmationEmail = async (user) => {
  try {
    console.log(`Envoi email confirmation à : ${user.email}`);
    const mailOptions = {
      from: 'Ñu Dem <no-reply@nudem.com>',
      to: user.email,
      subject: 'Bienvenue chez Ñu Dem !',
      html: `
        <h2>Bonjour ${user.prenom || 'Client'},</h2>
        <p>Jàmm ak jàmm ! Votre compte est créé.</p>
        <p><strong>Email :</strong> ${user.email}</p>
        <p>Connectez-vous pour réserver vos vols.</p>
        <p><a href="http://localhost:5173/connexion">Se connecter</a></p>
      `,
    };
    await transporter.sendMail(mailOptions);
    console.log(`Email confirmation envoyé à ${user.email}`);
  } catch (err) {
    console.error('Erreur envoi email confirmation:', err.message);
    throw err;
  }
};

module.exports = { sendTicketEmail, sendConfirmationEmail };