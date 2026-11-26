// server/src/utils/response.js

/**
 * Standard JSON Success Response
 */
const successResponse = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Standard JSON Error Response
 */
const errorResponse = (res, message = 'Internal Server Error', statusCode = 500, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    statusCode,
    message,
    errors,
    timestamp: new Date().toISOString(),
  });
};

module.exports = {
  successResponse,
  errorResponse,
};
