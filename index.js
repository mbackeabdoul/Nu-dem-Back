require('dotenv').config();
console.log('EMAIL_USER:', process.env.EMAIL_USER || 'MISSING');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '[REDACTED]' : 'MISSING');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? '[REDACTED]' : 'MISSING');
console.log('MONGO_URI:', process.env.MONGO_URI ? '[REDACTED]' : 'MISSING'); // Ajout pour débogage

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const apiRoutes = require('./routes/api');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', apiRoutes);

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connecté'))
  .catch(err => console.error('Erreur MongoDB:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));