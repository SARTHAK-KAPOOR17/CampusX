// server/src/modules/users/users.routes.js
const express = require('express');
const multer = require('multer');
const validate = require('../../middleware/validator');
const { authenticate } = require('../../middleware/auth');
const { updateProfileValidation, publicProfileValidation } = require('./users.validators');
const usersController = require('./users.controller');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max
  },
});

// Authenticated profile endpoints (must be registered before /:id)
router.get('/me/profile', authenticate, usersController.getMyProfile);
router.patch(
  '/me/profile',
  authenticate,
  validate(updateProfileValidation),
  usersController.updateMyProfile
);
router.post(
  '/me/avatar',
  authenticate,
  upload.single('avatar'),
  usersController.uploadAvatar
);

// Public profile endpoint
router.get('/:id', validate(publicProfileValidation), usersController.getPublicProfile);

module.exports = router;
