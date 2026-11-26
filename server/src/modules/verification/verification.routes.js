// server/src/modules/verification/verification.routes.js
const express = require('express');
const validate = require('../../middleware/validator');
const { authenticate } = require('../../middleware/auth');
const { requestOtpValidation, confirmOtpValidation } = require('./verification.validators');
const verificationController = require('./verification.controller');

const router = express.Router();

router.use(authenticate);

router.post('/request', validate(requestOtpValidation), verificationController.requestOtp);
router.post('/confirm', validate(confirmOtpValidation), verificationController.confirmOtp);
router.get('/status', verificationController.getStatus);

module.exports = router;
