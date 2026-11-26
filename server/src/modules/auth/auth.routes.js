// server/src/modules/auth/auth.routes.js
const express = require('express');
const validate = require('../../middleware/validator');
const { authLimiter } = require('../../middleware/security');
const { authenticate } = require('../../middleware/auth');
const { signupValidation, loginValidation } = require('./auth.validators');
const authController = require('./auth.controller');

const router = express.Router();

router.post('/signup', authLimiter, validate(signupValidation), authController.signup);
router.post('/login', authLimiter, validate(loginValidation), authController.login);
router.post('/refresh', authLimiter, authController.refresh);
router.post('/logout', authController.logout);
router.post('/logout-all', authenticate, authController.logoutAll);
router.get('/me', authenticate, authController.me);

module.exports = router;
