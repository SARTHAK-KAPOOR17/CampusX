// server/src/modules/users/users.routes.js
const express = require('express');
const multer = require('multer');
const validate = require('../../middleware/validator');
const { authenticate } = require('../../middleware/auth');
const { uploadLimiter } = require('../../middleware/security');
const { MAX_IMAGE_SIZE_BYTES } = require('../../services/images');
const { updateProfileValidation, publicProfileValidation } = require('./users.validators');
const usersController = require('./users.controller');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES, // 5MB max
    files: 1,
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
  uploadLimiter,
  upload.single('avatar'),
  usersController.uploadAvatar
);

// Public profile endpoint
router.get('/:id', validate(publicProfileValidation), usersController.getPublicProfile);

module.exports = router;
