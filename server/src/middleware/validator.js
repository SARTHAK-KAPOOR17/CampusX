// server/src/middleware/validator.js
const { validationResult } = require('express-validator');
const { errorResponse } = require('../utils/response');

/**
 * Middleware to check express-validator validation results
 */
const validate = (validations) => {
  return async (req, res, next) => {
    for (const validation of validations) {
      const result = await validation.run(req);
      if (result.errors.length) break;
    }

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    const extractedErrors = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    return errorResponse(res, 'Validation failed', 422, extractedErrors);
  };
};

module.exports = validate;
