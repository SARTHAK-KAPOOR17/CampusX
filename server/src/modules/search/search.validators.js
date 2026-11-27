// server/src/modules/search/search.validators.js
const { query } = require('express-validator');

const suggestValidation = [
  query('q')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Search query q must be between 2 and 50 characters'),
];

module.exports = {
  suggestValidation,
};
