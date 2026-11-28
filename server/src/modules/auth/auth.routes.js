// server/src/modules/auth/auth.routes.js
const express = require('express');
const validate = require('../../middleware/validator');
const { authLimiter } = require('../../middleware/security');
const { authenticate } = require('../../middleware/auth');
const {
  signupValidation,
  loginValidation,
  googleAuthValidation,
  setPasswordValidation,
} = require('./auth.validators');
const authController = require('./auth.controller');

const router = express.Router();

router.get('/config', authController.getAuthConfig);
router.post('/signup', authLimiter, validate(signupValidation), authController.signup);
router.post('/login', authLimiter, validate(loginValidation), authController.login);
router.post('/google', authLimiter, validate(googleAuthValidation), authController.googleLogin);
router.post('/refresh', authLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);
router.post('/set-password', authenticate, validate(setPasswordValidation), authController.setPassword);
router.get('/me', authenticate, authController.me);

module.exports = router;
