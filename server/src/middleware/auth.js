// server/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const { prisma } = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Verifies Bearer access token, loads the user from DB, and rejects inactive users.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authentication required. Please provide a valid Bearer token.', 401);
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new AppError('Authentication required. Token is empty.', 401);
  }

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.accessSecret);
  } catch (err) {
    throw new AppError('Invalid or expired access token.', 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      collegeEmail: true,
      isVerifiedStudent: true,
      verifiedAt: true,
      profilePictureUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError('User associated with this token no longer exists.', 401);
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated. Please contact an administrator.', 403);
  }

  req.user = user;
  next();
});

/**
 * Role-Based Access Control middleware factory.
 * Allows access only if req.user.role is included in allowed roles.
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Forbidden: you do not have permission to perform this action.', 403));
    }

    return next();
  };
};

/**
 * Ensures the authenticated user has completed university student verification.
 */
const requireVerifiedStudent = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required.', 401));
  }

  if (!req.user.isVerifiedStudent) {
    return next(
      new AppError(
        'Verified student status is required to perform this action. Please verify your college email.',
        403
      )
    );
  }

  return next();
};

module.exports = {
  authenticate,
  authorize,
  requireVerifiedStudent,
};
