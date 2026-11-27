// server/src/modules/admin/admin.validators.js
const { body, param, query } = require('express-validator');

const VALID_ROLES = ['STUDENT', 'MODERATOR', 'ADMIN'];

const listUsersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be between 1 and 100')
    .toInt(),
];

const updateUserRoleValidation = [
  param('id').isUUID().withMessage('Invalid user ID format'),
  body('role')
    .trim()
    .notEmpty()
    .withMessage('Role is required')
    .isIn(VALID_ROLES)
    .withMessage(`Role must be one of: ${VALID_ROLES.join(', ')}`),
];

const updateUserStatusValidation = [
  param('id').isUUID().withMessage('Invalid user ID format'),
  body('isActive').isBoolean().withMessage('isActive must be a boolean').toBoolean(),
];

module.exports = {
  listUsersValidation,
  updateUserRoleValidation,
  updateUserStatusValidation,
  VALID_ROLES,
};
