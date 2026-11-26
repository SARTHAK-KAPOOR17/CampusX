// server/src/modules/admin/admin.routes.js
const express = require('express');
const validate = require('../../middleware/validator');
const { authenticate, authorize } = require('../../middleware/auth');
const { listUsersValidation, updateUserRoleValidation } = require('./admin.validators');
const adminController = require('./admin.controller');

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

module.exports = router;
