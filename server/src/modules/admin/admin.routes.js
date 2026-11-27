// server/src/modules/admin/admin.routes.js
const express = require('express');
const validate = require('../../middleware/validator');
const { authenticate, authorize } = require('../../middleware/auth');
const {
  listUsersValidation,
  updateUserRoleValidation,
  updateUserStatusValidation,
} = require('./admin.validators');
const adminController = require('./admin.controller');
const { moderatorStatusValidation } = require('../products/products.validators');
const productsController = require('../products/products.controller');

const router = express.Router();

// All admin routes require authentication
router.use(authenticate);

// GET /api/admin/users (ADMIN and MODERATOR, paginated)
router.get(
  '/users',
  authorize('ADMIN', 'MODERATOR'),
  validate(listUsersValidation),
  adminController.listUsers
);

// PATCH /api/admin/users/:id/role (ADMIN only)
router.patch(
  '/users/:id/role',
  authorize('ADMIN'),
  validate(updateUserRoleValidation),
  adminController.updateUserRole
);

// PATCH /api/admin/users/:id/status (ADMIN only)
router.patch(
  '/users/:id/status',
  authorize('ADMIN'),
  validate(updateUserStatusValidation),
  adminController.updateUserStatus
);

// PATCH /api/admin/products/:id/status (ADMIN and MODERATOR moderation hook)
router.patch(
  '/products/:id/status',
  authorize('ADMIN', 'MODERATOR'),
  validate(moderatorStatusValidation),
  productsController.updateModeratorStatus
);

module.exports = router;
