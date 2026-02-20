const express = require('express');
const router = express.Router();
const controller = require('../controllers/OnboardVerificationController');

// CIN
router.get('/cin/status', controller.getCINStatus);
router.post('/verify-cin', controller.verifyCIN);

// GST
router.get('/gst/status', controller.getGSTStatus);
router.post('/verify-gst', controller.verifyGST);

// PAN
router.get('/pan/status', controller.getPANStatus);
router.post('/verify-pan', controller.verifyPAN);

// Bank
router.get('/bank/status', controller.getBankStatus);
router.post('/verify-bank', controller.verifyBank);

// Aadhaar
router.post('/aadhaar/send-otp', controller.sendAadhaarOTP);
router.post('/aadhaar/verify-otp', controller.verifyAadhaarOTP);
router.get('/aadhaar/status', controller.getAadhaarStatus);

module.exports = router;