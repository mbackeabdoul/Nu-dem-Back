// Modifications à apporter à emailService.js
const nodemailer = require('nodemailer');
const { jsPDF } = require('jspdf');

// Création du transporteur avec meilleure gestion des erreurs
let transporter;
try {
  // Vérification des identifiants
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('Configuration email manquante: EMAIL_USER ou EMAIL_PASS non définis');
    throw new Error('Configuration email manquante');
  }
  
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    debug: true, // Active les logs de débogage
  });
  
  // Test de la connexion au serveur SMTP
  transporter.verify(function(error, success) {
    if (error) {
      console.error('Erreur de configuration du transporteur email:', error);
    } else {
      console.log('Serveur SMTP prêt à envoyer des emails');
    }
  });
} catch (err) {
  console.error('Erreur lors de la configuration du transporteur email:', err);
}

const sendTicketEmail = async (booking) => {
  try {
    // Double vérification des identifiants
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('Missing email credentials in sendTicketEmail');
      throw new Error('Identifiants email manquants');
    }
    
    if (!booking.customerEmail) {
      console.error('Missing customer email:', booking);
      throw new Error('Email du client manquant');
    }
    
    // Vérification de la configuration du transporteur
    if (!transporter) {
      console.error('Transporter not initialized');
      throw new Error('Service email non configuré');
    }
    
    console.log(`Sending ticket email to: ${booking.customerEmail}`);
    
    // Vérification des données du billet
    if (!booking.departureDateTime || isNaN(new Date(booking.departureDateTime).getTime())) {
      console.error('Invalid departureDateTime:', booking.departureDateTime);
      throw new Error('Date de départ invalide');
    }
    
    if (!booking.ticketNumber || !booking.ticketToken) {
      console.error('Missing ticketNumber or ticketToken:', booking);
      throw new Error('Numéro de billet ou token manquant');
    }
    
    const pdfBuffer = generateTicketPDF(booking);
    
    const mailOptions = {
      from: 'Ñu Dem <no-reply@nudem.com>',
      to: booking.customerEmail,
      subject: `Votre billet électronique pour ${booking.departure} → ${booking.arrival}`,
      html: `
        <h2>Bonjour ${booking.customerName},</h2>
        <p>Jàmm ak jàmm ! Merci d'avoir réservé avec Ñu Dem ! Votre billet pour votre vol de ${booking.departure} à ${booking.arrival} est en pièce jointe.</p>
        <p><strong>Numéro de billet :</strong> ${booking.ticketNumber}</p>
        <p><strong>Date de départ :</strong> ${new Date(booking.departureDateTime).toLocaleString('fr-FR')}</p>
        <p><strong>Compagnie :</strong> ${booking.airline}</p>
        <p><strong>Vol :</strong> ${booking.flightNumber}</p>
        <p><strong>Prix :</strong> ${booking.price} XOF</p>
        <p>Veuillez présenter ce billet (imprimé ou sur votre téléphone) et une pièce d'identité à l'embarquement.</p>
        <p>Vous pouvez scanner le QR code sur le billet pour vérifier les détails de votre vol.</p>
        <p>Ñu Dem vous souhaite un bon voyage !</p>
        <p>L'équipe Ñu Dem</p>
      `,
      attachments: [
        {
          filename: `billet-${booking.ticketNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };
    
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${booking.customerEmail}, messageId: ${info.messageId}`);
      return info;
    } catch (err) {
      console.error('Error during SMTP transaction:', err);
      throw new Error(`Erreur lors de l'envoi de l'e-mail: ${err.message}`);
    }
  } catch (err) {
    console.error('Error in sendTicketEmail function:', err);
    throw new Error('Erreur lors de l'envoi de l'e-mail');
  }
};
const generateTicketPDF = (booking) => {
  if (!booking.departureDateTime || isNaN(new Date(booking.departureDateTime).getTime())) {
    console.error('Invalid departureDateTime:', booking.departureDateTime);
    throw new Error('Date de départ invalide');
  }
  if (!booking.ticketNumber || !booking.ticketToken) {
    console.error('Missing ticketNumber or ticketToken:', booking);
    throw new Error('Numéro de billet ou token manquant');
  }
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
  doc.text(`Passager: ${booking.customerName}`, 20, 50);
  doc.text(`Vol: ${booking.flightNumber}`, 20, 60);
  doc.text(`Compagnie: ${booking.airline}`, 20, 70);
  doc.text(`Départ: ${booking.departure}`, 20, 80);
  doc.text(`Arrivée: ${booking.arrival}`, 20, 90);
  doc.text(`Date: ${new Date(booking