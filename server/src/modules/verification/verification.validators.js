// server/src/modules/verification/verification.validators.js
const { body } = require('express-validator');

const requestOtpValidation = [
  body('collegeEmail')
    .trim()
    .notEmpty()
    .withMessage('College email is required')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
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
