// server/src/modules/products/products.validators.js
const { body, param, query } = require('express-validator');

const VALID_CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'USED'];
const VALID_STATUSES = ['DRAFT', 'ACTIVE', 'RESERVED', 'SOLD', 'EXPIRED', 'UNDER_REVIEW'];
const SELLER_TARGET_STATUSES = ['ACTIVE', 'RESERVED', 'SOLD'];
const MODERATOR_TARGET_STATUSES = ['ACTIVE', 'UNDER_REVIEW'];

const isValidDecimalPrice = (value) => {
  if (value === null || value === undefined || value === '') return false;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 99999999.99) return false;
  // Allow up to 2 decimal places
  return /^\d+(\.\d{1,2})?$/.test(String(value).trim());
};

const createProductValidation = [
  body('saveAsDraft')
    .optional()
    .isBoolean()
    .withMessage('saveAsDraft must be a boolean')
    .toBoolean(),

  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 1, max: 120 })
    .withMessage('Title must be between 1 and 120 characters'),

  body('description')
    .optional({ values: 'null' })
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be at most 2000 characters'),

  body('price')
    .optional({ values: 'null' })
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      if (!isValidDecimalPrice(value)) {
        throw new Error('Price must be a valid non-negative number with at most 2 decimal places');
      }
      return true;
    }),

  body('categoryId')
    .optional({ values: 'null' })
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(String(value))) {
        throw new Error('categoryId must be a valid UUID');
      }
      return true;
    }),

  body('condition')
    .optional({ values: 'null' })
    .custom((value) => {
      if (value === '' || value === null || value === undefined) return true;
      if (!VALID_CONDITIONS.includes(value)) {
        throw new Error(`Condition must be one of: ${VALID_CONDITIONS.join(', ')}`);
      }
      return true;
    }),

  body('isNegotiable')
    .optional()
    .isBoolean()
    .withMessage('isNegotiable must be a boolean')
    .toBoolean(),

  body('tags')
    .optional()
    .isArray({ max: 10 })
    .withMessage('tags must be an array with at most 10 items'),
  body('tags.*')
    .optional()
    .isString()
    .withMessage('Each tag must be a string')
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('Each tag must be between 1 and 30 characters'),

  // Enforce complete fields when publishing immediately (saveAsDraft !== true)
  body().custom((_, { req }) => {
    const saveAsDraft = req.body.saveAsDraft === true || req.body.saveAsDraft === 'true';
    if (saveAsDraft) return true;

    const missing = [];
    if (!req.body.description || !String(req.body.description).trim()) missing.push('description');
    if (req.body.price === undefined || req.body.price === null || req.body.price === '') {
      missing.push('price');
    }
    if (!req.body.categoryId) missing.push('categoryId');
    if (!req.body.condition) missing.push('condition');

    if (missing.length > 0) {
      throw new Error(`Publishing requires: ${missing.join(', ')}`);
    }
    return true;
  }),
];

const updateProductValidation = [
  param('id').isUUID().withMessage('Invalid product ID format'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 120 })
    .withMessage('Title must be between 1 and 120 characters'),

  body('description')
    .optional({ values: 'null' })
    .trim()
    .isLength({ max: 2000 })
    .withMessage('Description must be at most 2000 characters'),

  body('price')
    .optional({ values: 'null' })
    .custom((value) => {
      if (value === null || value === '' || value === undefined) return true;
      if (!isValidDecimalPrice(value)) {
        throw new Error('Price must be a valid non-negative number with at most 2 decimal places');
      }
      return true;
    }),

  body('categoryId')
    .optional({ values: 'null' })
    .custom((value) => {
      if (value === null || value === '' || value === undefined) return true;
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(String(value))) {
        throw new Error('categoryId must be a valid UUID');
      }
      return true;
    }),

  body('condition')
    .optional({ values: 'null' })
    .custom((value) => {
      if (value === null || value === '' || value === undefined) return true;
      if (!VALID_CONDITIONS.includes(value)) {
        throw new Error(`Condition must be one of: ${VALID_CONDITIONS.join(', ')}`);
      }
      return true;
    }),

  body('isNegotiable')
    .optional()
    .isBoolean()
    .withMessage('isNegotiable must be a boolean')
    .toBoolean(),

  body('tags')
    .optional()
    .isArray({ max: 10 })
    .withMessage('tags must be an array with at most 10 items'),
  body('tags.*')
    .optional()
    .isString()
    .withMessage('Each tag must be a string')
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('Each tag must be between 1 and 30 characters'),
];

const productIdValidation = [
  param('id').isUUID().withMessage('Invalid product ID format'),
];

const sellerStatusValidation = [
  param('id').isUUID().withMessage('Invalid product ID format'),
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Target status is required')
    .isIn(SELLER_TARGET_STATUSES)
    .withMessage(`Seller status must be one of: ${SELLER_TARGET_STATUSES.join(', ')}`),
];

const moderatorStatusValidation = [
  param('id').isUUID().withMessage('Invalid product ID format'),
  body('status')
    .trim()
    .notEmpty()
    .withMessage('Target status is required')
    .isIn(MODERATOR_TARGET_STATUSES)
    .withMessage(`Moderation status must be one of: ${MODERATOR_TARGET_STATUSES.join(', ')}`),
];

const VALID_AVAILABILITY = ['available', 'reserved', 'all'];
const VALID_SORTS = ['newest', 'price_asc', 'price_desc', 'popularity', 'relevance'];

const listProductsValidation = [
  query('q')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query q must be at most 100 characters'),
  query('categoryId')
    .optional({ values: 'falsy' })
    .isUUID()
    .withMessage('categoryId must be a valid UUID'),
  query('category')
    .optional({ values: 'falsy' })
    .isString()
    .trim()
    .isLength({ max: 64 })
    .withMessage('category slug must be at most 64 characters'),
  query('minPrice')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0 })
    .withMessage('minPrice must be a non-negative number')
    .toFloat(),
  query('maxPrice')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0 })
    .withMessage('maxPrice must be a non-negative number')
    .toFloat(),
  query('condition')
    .optional({ values: 'falsy' })
    .custom((value) => {
      const tokens = String(value)
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean);
      const invalid = tokens.filter((t) => !VALID_CONDITIONS.includes(t));
      if (invalid.length > 0) {
        throw new Error(`Invalid condition value(s): ${invalid.join(', ')}`);
      }
      return true;
    }),
  query('availability')
    .optional({ values: 'falsy' })
    .isIn(VALID_AVAILABILITY)
    .withMessage(`availability must be one of: ${VALID_AVAILABILITY.join(', ')}`),
  query('isNegotiable')
    .optional({ values: 'falsy' })
    .isBoolean()
    .withMessage('isNegotiable must be a boolean')
    .toBoolean(),
  query('verifiedSeller')
    .optional({ values: 'falsy' })
    .isBoolean()
    .withMessage('verifiedSeller must be a boolean')
    .toBoolean(),
  query('sort')
    .optional({ values: 'falsy' })
    .isIn(VALID_SORTS)
    .withMessage(`sort must be one of: ${VALID_SORTS.join(', ')}`),
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('limit must be between 1 and 50')
    .toInt(),
  query().custom((_, { req }) => {
    const min = req.query.minPrice;
    const max = req.query.maxPrice;
    if (min !== undefined && min !== '' && max !== undefined && max !== '' && Number(min) > Number(max)) {
      throw new Error('minPrice cannot be greater than maxPrice');
    }
    const sortVal = req.query.sort;
    const qVal = req.query.q ? String(req.query.q).trim() : '';
    if (sortVal === 'relevance' && !qVal) {
      throw new Error('sort=relevance is only valid when search query q is provided');
    }
    return true;
  }),
];

const listMyProductsValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be >= 1').toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('limit must be between 1 and 50')
    .toInt(),
  query('status')
    .optional()
    .isIn(VALID_STATUSES)
    .withMessage(`status must be one of: ${VALID_STATUSES.join(', ')}`),
];

module.exports = {
  VALID_CONDITIONS,
  VALID_STATUSES,
  VALID_AVAILABILITY,
  VALID_SORTS,
  createProductValidation,
  updateProductValidation,
  productIdValidation,
  sellerStatusValidation,
  moderatorStatusValidation,
  listProductsValidation,
  listMyProductsValidation,
};
