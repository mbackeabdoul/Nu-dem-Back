const nodemailer = require('nodemailer');
const { jsPDF } = require('jspdf');
const QRCode = require('qrcode');
const fs = require('fs').promises;
const path = require('path');

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
  service: 'gmail', // ou votre service email
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Fonction pour convertir l'image en base64 - VERSION CORRIGÉE
const getLogoBase64 = async () => {
  try {
    // Plusieurs chemins possibles à tester
    const possiblePaths = [
      path.join(__dirname, '../images/logo.png'),
      path.join(__dirname, '../public/images/logo.png'),
      path.join(__dirname, 'images/logo.png'),
      path.join(process.cwd(), 'images/logo.png'),
      path.join(process.cwd(), 'public/images/logo.png')
    ];

    let logoBuffer = null;
    let usedPath = null;

    // Tester chaque chemin
    for (const logoPath of possiblePaths) {
      try {
        console.log(`Tentative de lecture du logo: ${logoPath}`);
        logoBuffer = await fs.readFile(logoPath);
        usedPath = logoPath;
        console.log(`Logo trouvé et lu avec succès: ${usedPath}`);
        break;
      } catch (error) {
        console.log(`Logo non trouvé à: ${logoPath}`);
        continue;
      }
    }

    if (!logoBuffer) {
      console.log('Aucun logo trouvé dans les chemins testés');
      return null;
    }

    const base64String = logoBuffer.toString('base64');
    console.log(`Logo converti en base64, taille: ${base64String.length} caractères`);
    return `data:image/png;base64,${base64String}`;

  } catch (error) {
    console.error('Erreur lors de la conversion du logo:', error);
    return null;
  }
};

// Fonction pour générer le QR code
const generateQRCode = async (data) => {
  try {
    return await QRCode.toDataURL(data, {
      width: 150,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
  } catch (error) {
    console.error('Erreur génération QR code:', error);
    return null;
  }
};

// Fonction pour formater la date
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

// Fonction pour formater l'heure
const formatTime = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

// Fonction pour générer le PDF du billet
const generateTicketPDF = async (booking) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  try {
    const primaryColor = [41, 128, 185]; // Bleu
    const secondaryColor = [52, 73, 94]; // Gris foncé
    const accentColor = [231, 76, 60]; // Rouge
    const lightGray = [236, 240, 241];

    // En-tête
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, 'F');

    // Logo - VERSION CORRIGÉE
    const logoBase64 = await getLogoBase64();
    if (logoBase64) {
      try {
        console.log('Ajout du logo au PDF...');
        doc.addImage(logoBase64, 'PNG', 15, 8, 25, 25);
        console.log('Logo ajouté avec succès au PDF');
      } catch (logoError) {
        console.error('Erreur lors de l\'ajout du logo au PDF:', logoError);
        // Continuer sans logo
      }
    } else {
      console.log('Pas de logo disponible pour le PDF');
    }

    // Titre
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('BILLET ÉLECTRONIQUE', 50, 20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`N° ${booking.ticketNumber}`, 50, 30);

    // Informations passager
    doc.setFillColor(...lightGray);
    doc.rect(15, 50, 180, 25, 'F');
    doc.setTextColor(...secondaryColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMATIONS PASSAGER', 20, 60);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Nom: ${booking.customerName || 'N/A'}`, 20, 68);
    doc.text(`Email: ${booking.customerEmail || 'N/A'}`, 20, 74);
    doc.text(`Téléphone: ${booking.customerPhone || 'N/A'}`, 120, 68);
    doc.text(`Siège: ${booking.seat || 'Non assigné'}`, 120, 74);

    // Détails du vol
    doc.setFillColor(...primaryColor);
    doc.rect(15, 85, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DÉTAILS DU VOL', 20, 91);

    doc.setTextColor(...secondaryColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    const ticketType = booking.returnDepartureDateTime ? 'Aller-Retour' : 'Aller Simple';
    doc.text(`Type de billet: ${ticketType}`, 20, 100);


    // Départ et arrivée
    doc.setTextColor(...secondaryColor);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(booking.departure || 'N/A', 25, 110);
    doc.text('→', 95, 115);
    doc.text(booking.arrival || 'N/A', 130, 110);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('DÉPART', 25, 105);
    doc.text(formatDate(booking.departureDateTime), 25, 118);
    doc.text(formatTime(booking.departureDateTime), 25, 124);
    doc.text('ARRIVÉE', 130, 105);
    if (booking.arrivalDateTime && booking.arrivalDateTime !== 'Non spécifié') {
      doc.text(formatDate(booking.arrivalDateTime), 130, 118);
      doc.text(formatTime(booking.arrivalDateTime), 130, 124);
    }

    

    // retour et arrivée retour

    let yPosition = 135;
    if (booking.returnDepartureDateTime) {
      doc.setTextColor(...secondaryColor);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(booking.returnDeparture || booking.arrival, 25, yPosition);
      doc.text('→', 95, yPosition + 5);
      doc.text(booking.returnArrival || booking.departure, 130, yPosition);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('DÉPART RETOUR', 25, yPosition - 5);
      doc.text(formatDate(booking.returnDepartureDateTime), 25, yPosition + 8);
      doc.text(formatTime(booking.returnDepartureDateTime), 25, yPosition + 14);
      doc.text('ARRIVÉE RETOUR', 130, yPosition - 5);
      if (booking.returnArrivalDateTime && booking.returnArrivalDateTime !== 'Non spécifié') {
        doc.text(formatDate(booking.returnArrivalDateTime), 130, yPosition + 8);
        doc.text(formatTime(booking.returnArrivalDateTime), 130, yPosition + 14);
      }
      yPosition += 30;
    }
  


    // Vol et compagnie
    doc.setFillColor(245, 245, 245);
    doc.rect(15, 135, 85, 25, 'F');
    doc.setTextColor(...secondaryColor);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('VOL', 20, 145);
    doc.setFontSize(14);
    doc.text(booking.flightNumber || 'N/A', 20, 152);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Compagnie: ${booking.airline || 'N/A'}`, 20, 158);

    // Prix
    doc.setFillColor(...accentColor);
    doc.rect(110, 135, 85, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('PRIX TOTAL', 115, 145);
    doc.setFontSize(16);
    doc.text(`${booking.price || 0} ${booking.currency || 'EUR'}`, 115, 155);

    // QR Code (format compatible avec l'ancienne version)
    const qrData = `QR:${booking.ticketNumber}:${booking.ticketToken}`; // Format attendu pour /verify-ticket
    const qrCodeDataURL = await generateQRCode(qrData);
    if (qrCodeDataURL) {
      doc.addImage(qrCodeDataURL, 'PNG', 15, 170, 40, 40);
      doc.setTextColor(...secondaryColor);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Scannez ce code pour', 15, 218);
      doc.text('vérification', 15, 224);
    }

    // Informations importantes
    doc.setFillColor(255, 243, 205);
    doc.rect(65, 170, 130, 40, 'F');
    doc.setTextColor(...secondaryColor);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('INFORMATIONS IMPORTANTES', 70, 180);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('• Présentez-vous 2h avant le départ', 70, 188);
    doc.text('• Pièce d\'identité valide requise', 70, 194);
    doc.text('• Enregistrement en ligne recommandé', 70, 200);
    doc.text(`Enregistrement: ${formatTime(booking.checkInTime) || 'N/A'}`, 70, 206);

    // Statut du paiement
    const paymentColor = booking.paymentStatus === 'completed' ? [46, 204, 113] : [241, 196, 15];
    doc.setFillColor(...paymentColor);
    doc.rect(15, 220, 180, 15, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    const statusText = booking.paymentStatus === 'completed' ? 'PAIEMENT CONFIRMÉ' : 'PAIEMENT EN ATTENTE';
    doc.text(statusText, 20, 230);

    // Pied de page
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Valable uniquement pour le vol mentionné.', 15, 250);
    doc.text('Conservez ce document jusqu\'à destination.', 15, 255);
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 15, 265);

    return Buffer.from(doc.output('arraybuffer'));
  } catch (error) {
    console.error('Erreur génération PDF:', error);
    throw error;
  }
};

// Templates email
const getEmailTemplate = (booking, isConfirmation = false) => {
  const logoHTML = `<img src="cid:logo" alt="Logo" style="height: 50px; margin-bottom: 20px;">`;

  if (isConfirmation) {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><style>body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;margin:0;padding:0;background-color:#f8f9fa}.container{max-width:600px;margin:0 auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1)}.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:40px 30px;text-align:center}.content{padding:40px 30px}.button{display:inline-block;background:#667eea;color:white;padding:12px 30px;text-decoration:none;border-radius:25px;margin:20px 0;font-weight:bold}.footer{background:#f8f9fa;padding:20px 30px;text-align:center;color:#6c757d;font-size:14px}</style></head>
      <body><div class="container"><div class="header">${logoHTML}<h1>Bienvenue ${booking.prenom} !</h1><p>Votre compte a été créé avec succès</p></div><div class="content"><h2>Félicitations ! 🎉</h2><p>Votre inscription a été confirmée. Vous pouvez maintenant :</p><ul><li>Rechercher et réserver des vols</li><li>Gérer vos réservations</li><li>Recevoir vos billets par email</li></ul><a href="#" class="button">Commencer à réserver</a></div><div class="footer"><p>Merci de votre confiance !</p></div></div></body></html>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><style>body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;margin:0;padding:0;background-color:#f8f9fa}.container{max-width:600px;margin:0 auto;background:white;border-radius:10px;overflow:hidden;box-shadow:0 4px 6px rgba(0,0,0,0.1)}.header{background:linear-gradient(135deg,#2980b9 0%,#3498db 100%);color:white;padding:40px 30px;text-align:center}.ticket{background:white;margin:20px;border-radius:10px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.1)}.ticket-header{background:linear-gradient(135deg,#2980b9,#3498db);color:white;padding:20px}.flight-info{display:flex;justify-content:space-between;align-items:center;margin:20px 0}.location{text-align:center;flex:1}.location-code{font-size:24px;font-weight:bold;color:#2c3e50}.location-name{font-size:12px;color:#7f8c8d;margin-top:5px}.arrow{font-size:20px;color:#3498db;margin:0 20px}.details{padding:20px;background:#f8f9fa}.detail-row{display:flex;justify-content:space-between;margin:10px 0}.qr-section{text-align:center;padding:20px;background:#ecf0f1}.status{padding:15px;text-align:center;font-weight:bold;color:white}.status.completed{background:#27ae60}.status.pending{background:#f39c12}.footer{background:#34495e;color:white;padding:20px 30px;text-align:center}</style></head>
    <body><div class="container"><div class="header">${logoHTML}<h1>Votre Billet Électronique</h1><p>Réservation confirmée - N° ${booking.ticketNumber}</p></div><div class="ticket"><div class="ticket-header"><h2>Détails du Vol</h2><p>Vol ${booking.flightNumber || 'N/A'} - ${booking.airline || 'Compagnie'}</p></div><div style="padding:20px"><div class="flight-info"><div class="location"><div class="location-code">${booking.departure || 'N/A'}</div><div class="location-name">DÉPART</div><div style="margin-top:10px;font-weight:bold">${formatTime(booking.departureDateTime)}</div><div style="font-size:12px;color:#7f8c8d">${formatDate(booking.departureDateTime)}</div></div><div class="arrow">✈️</div><div class="location"><div class="location-code">${booking.arrival || 'N/A'}</div><div class="location-name">ARRIVÉE</div>${booking.arrivalDateTime && booking.arrivalDateTime !== 'Non spécifié' ? `<div style="margin-top:10px;font-weight:bold">${formatTime(booking.arrivalDateTime)}</div><div style="font-size:12px;color:#7f8c8d">${formatDate(booking.arrivalDateTime)}</div>` : ''}</div></div><div class="details"><div class="detail-row"><span><strong>Passager:</strong></span><span>${booking.customerName || 'N/A'}</span></div><div class="detail-row"><span><strong>Siège:</strong></span><span>${booking.seat || 'Non assigné'}</span></div><div class="detail-row"><span><strong>Prix:</strong></span><span><strong>${booking.price || 0} ${booking.currency || 'EUR'}</strong></span></div><div class="detail-row"><span><strong>Enregistrement:</strong></span><span>${formatTime(booking.checkInTime) || 'N/A'}</span></div></div></div><div class="status ${booking.paymentStatus}">${booking.paymentStatus === 'completed' ? '✅ PAIEMENT CONFIRMÉ' : '⏳ PAIEMENT EN ATTENTE'}</div></div><div class="qr-section"><h3>Code de Vérification</h3><p>Présentez ce billet à l'aéroport ou scannez le QR code dans le PDF joint</p></div><div class="footer"><p><strong>Instructions importantes:</strong></p><p>• Arrivez 2h avant le départ international</p><p>• Munissez-vous d'une pièce d'identité valide</p><p>• Le PDF joint contient votre QR code de vérification</p></div></div></body></html>
  `;
};

// Fonctions d'envoi
const sendTicketEmail = async (booking) => {
  try {
    const pdfBuffer = await generateTicketPDF(booking);
    
    // Chercher le logo pour l'email avec les mêmes chemins que le PDF
    const possibleLogoPaths = [
      path.join(__dirname, '../images/logo.png'),
      path.join(__dirname, '../public/images/logo.png'),
      path.join(__dirname, 'images/logo.png'),
      path.join(process.cwd(), 'images/logo.png'),
      path.join(process.cwd(), 'public/images/logo.png')
    ];

    let logoPath = null;
    for (const testPath of possibleLogoPaths) {
      try {
        await fs.access(testPath);
        logoPath = testPath;
        break;
      } catch (error) {
        continue;
      }
    }
    const isRoundTrip = booking.returnDepartureDateTime;

    const downloadLink = `http://localhost:5000/api/generate-ticket/${booking._id}`;
    const mailOptions = {
      from: 'Ñu Dem <no-reply@nudem.com>',
      to: booking.customerEmail,
      subject: `Votre billet pour ${booking.departure || 'N/A'} → ${booking.arrival || 'N/A'}`,
      html: `
        <h2>Bonjour ${booking.customerName || 'Client'},</h2>
        <p>Dallal ak jàmm ! Votre billet est en pièce jointe.</p>
          <p><strong>Type:</strong> ${isRoundTrip ? 'Aller-Retour' : 'Aller Simple'}</p>
        <p><strong>Numéro de billet :</strong> ${booking.ticketNumber || 'N/A'}</p>

        <p><strong>Date de départ :</strong> ${booking.departureDateTime ? new Date(booking.departureDateTime).toLocaleString('fr-FR') : 'N/A'}</p>

        ${isRoundTrip ? `<p><strong>Date de retour :</strong> ${booking.returnDepartureDateTime ? new Date(booking.returnDepartureDateTime).toLocaleString('fr-FR') : 'N/A'}</p>` : ''}
        
        <p><strong>Compagnie :</strong> ${booking.airline || 'N/A'}</p>


        <p><strong>Vol :</strong> ${booking.flightNumber || 'N/A'}</p>
        <p><strong>Prix :</strong> ${booking.price || 0} ${booking.currency || 'EUR'}</p>
        <p><a href="${downloadLink}">Télécharger votre billet</a></p>
        <p>Présentez ce billet à l'embarquement.</p>
        <p>Bon voyage !</p>
      `,
      attachments: [
        {
          filename: `billet-${booking.ticketNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    if (logoPath) {
      mailOptions.attachments.push({
        filename: 'logo.png',
        path: logoPath,
        cid: 'logo',
      });
      console.log(`Logo ajouté à l'email depuis: ${logoPath}`);
    } else {
      console.log('Logo non trouvé pour l\'email, envoyé sans logo');
    }

    const result = await transporter.sendMail(mailOptions);
    console.log('Email de billet envoyé:', result.messageId);
    return result;
  } catch (error) {
    console.error('Erreur envoi email billet:', error);
    throw error;
  }
};

const sendConfirmationEmail = async (user) => {
  try {
    // Chercher le logo avec les mêmes chemins
    const possibleLogoPaths = [
      path.join(__dirname, '../images/logo.png'),
      path.join(__dirname, '../public/images/logo.png'),
      path.join(__dirname, 'images/logo.png'),
      path.join(process.cwd(), 'images/logo.png'),
      path.join(process.cwd(), 'public/images/logo.png')
    ];

    let logoPath = null;
    for (const testPath of possibleLogoPaths) {
      try {
        await fs.access(testPath);
        logoPath = testPath;
        break;
      } catch (error) {
        continue;
      }
    }

    const mailOptions = {
      from: 'Ñu Dem <no-reply@nudem.com>',
      to: user.email,
      subject: 'Bienvenue chez Ñu Dem !',
      html: getEmailTemplate(user, true),
    };

    if (logoPath) {
      mailOptions.attachments = [{
        filename: 'logo.png',
        path: logoPath,
        cid: 'logo',
      }];
      console.log(`Logo ajouté à l'email de confirmation depuis: ${logoPath}`);
    } else {
      console.log('Logo non trouvé pour l\'email de confirmation, envoyé sans logo');
    }

    const result = await transporter.sendMail(mailOptions);
    console.log('Email de confirmation envoyé:', result.messageId);
    return result;
  } catch (error) {
    console.error('Erreur envoi email confirmation:', error);
    throw error;
  }
};

module.exports = { sendTicketEmail, sendConfirmationEmail, generateTicketPDF };