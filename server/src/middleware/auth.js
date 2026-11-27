// server/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const { prisma } = require('../config/db');
const cache = require('../services/cache');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const authCacheKey = (userId) => `auth:user:${userId}`;

/**
 * Loads minimal auth identity (never passwordHash) via 60s Redis cache.
 */
const loadAuthUser = async (userId) => {
  return cache.getOrSet(authCacheKey(userId), config.cache.authTtlSeconds, async () => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        isActive: true,
        isVerifiedStudent: true,
      },
    });
    return user || null;
  });
};

const invalidateAuthUserCache = async (userId) => {
  if (!userId) return;
  await cache.del(authCacheKey(userId));
};

/**
 * Verifies Bearer access token, loads the user (cached 60s), and rejects inactive users.
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

  const user = await loadAuthUser(decoded.sub);

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

/**
 * Optionally parses Bearer JWT if provided; proceeds anonymously if absent or invalid.
 */
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret);
    const user = await loadAuthUser(decoded.sub);
    req.user = user && user.isActive ? user : null;
  } catch {
    req.user = null;
  }

  return next();
});

module.exports = {
  authenticate,
  optionalAuthenticate,
  authorize,
  requireVerifiedStudent,
  invalidateAuthUserCache,
  authCacheKey,
};
