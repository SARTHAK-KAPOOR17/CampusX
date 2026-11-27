// server/src/modules/verification/verification.validators.js
const { body } = require('express-validator');

const requestOtpValidation = [
  // Strict collegeEmail validation (trim, lowercase, local-part + exact domain match)
  // is handled in verification.service.js so all invalid/disallowed emails return a consistent 400.
];

const confirmOtpValidation = [
  body('otp')
    .trim()
    .notEmpty()
    .withMessage('OTP is required')
    .matches(/^\d{6}$/)
    .withMessage('OTP must be a 6-digit code'),
];

module.exports = {
  requestOtpValidation,
  confirmOtpValidation,
};
