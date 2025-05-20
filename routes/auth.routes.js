const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller'); 
const reset = require('../controllers/reset.controller'); 

router.post('/inscription', auth.inscription);         
router.post('/connexion', auth.connexion);
router.post('/forgot-password', reset.forgotPassword);
router.post('/reset-password', reset.resetPassword);

module.exports = router;
