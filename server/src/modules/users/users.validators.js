// server/src/modules/users/users.validators.js
const { body, param } = require('express-validator');

const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Name must be between 2 and 80 characters'),

  body('course')
    .optional({ values: 'null' })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Course must be at most 100 characters'),

  body('branch')
    .optional({ values: 'null' })
    .trim()
    .isLength({ max: 100 })
    .withMessage('Branch must be at most 100 characters'),

  body('year')
    .optional({ values: 'null' })
    .isInt({ min: 1, max: 6 })
    .withMessage('Year must be an integer between 1 and 6')
    .toInt(),

  body('bio')
    .optional({ values: 'null' })
    .trim()
    .isLength({ max: 300 })
    .withMessage('Bio must be at most 300 characters'),
];

const publicProfileValidation = [
  param('id').isUUID().withMessage('Invalid user ID format'),
];

module.exports = {
  updateProfileValidation,
  publicProfileValidation,
};
