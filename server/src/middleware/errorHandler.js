// server/src/middleware/errorHandler.js
const logger = require('../utils/logger');
const { errorResponse } = require('../utils/response');

/**
 * Central Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  logger.error(
    {
      err: {
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
        code: err.code,
      },
      path: req.originalUrl,
      method: req.method,
    },
    'Unhandled Application Error'
  );

  // Prisma unique constraint violation
  if (err.code === 'P2002') {
    const fields = err.meta?.target || 'field';
    return errorResponse(res, `A record with this ${fields} already exists.`, 409);
  }

  // Prisma record not found
  if (err.code === 'P2025') {
    return errorResponse(res, 'Record not found.', 404);
  }

  // CORS error
  if (err.message && err.message.includes('CORS policy')) {
    return errorResponse(res, err.message, 403);
  }

  // JSON parsing error / syntax error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return errorResponse(res, 'Malformed JSON payload in request body.', 400);
  }

  // Default server error
  const statusCode = err.statusCode || err.status || 500;
  const message = err.isOperational ? err.message : (statusCode === 500 ? 'Internal Server Error' : err.message);

  return errorResponse(res, message, statusCode, err.errors || null);
};

module.exports = errorHandler;
