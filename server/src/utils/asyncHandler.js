// server/src/utils/asyncHandler.js

/**
 * Higher-order wrapper to catch errors in async route handlers and forward to Express next()
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
