// server/src/modules/auth/auth.service.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { prisma } = require('../../config/db');
const logger = require('../../utils/logger');
const AppError = require('../../utils/AppError');
const { formatUserWithAvatar } = require('../../utils/userFormatter');

const USER_PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  collegeEmail: true,
  isVerifiedStudent: true,
  verifiedAt: true,
  avatarKey: true,
  course: true,
  branch: true,
  year: true,
  bio: true,
  ratingAverage: true,
  ratingCount: true,
  createdAt: true,
  updatedAt: true,
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

const hashToken = (rawToken) => {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn }
  );
};

const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

const getRefreshExpiryDate = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + config.jwt.refreshExpiresDays);
  return expiresAt;
};

/**
 * Registers a new STUDENT account.
 */
const signup = async ({ name, email, password, userAgent = null, ip = null }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existing) {
    throw new AppError('An account with this email already exists.', 409);
  }

  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'STUDENT',
    },
    select: USER_PUBLIC_SELECT,
  });

  const accessToken = generateAccessToken(user);
  const rawRefreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawRefreshToken),
      expiresAt: getRefreshExpiryDate(),
      userAgent,
      ip,
    },
  });

  return {
    user: await formatUserWithAvatar(user),
    accessToken,
    refreshToken: rawRefreshToken,
  };
};

/**
 * Authenticates a user with generic error messages to avoid email enumeration.
 */
const login = async ({ email, password, userAgent = null, ip = null }) => {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new AppError('Invalid email or password.', 401);
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password.', 401);
  }

  if (!user.isActive) {
    throw new AppError('Account is deactivated. Please contact an administrator.', 403);
  }

  const accessToken = generateAccessToken(user);
  const rawRefreshToken = generateRefreshToken();

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawRefreshToken),
      expiresAt: getRefreshExpiryDate(),
      userAgent,
      ip,
    },
  });

  return {
    user: await formatUserWithAvatar(sanitizeUser(user)),
    accessToken,
    refreshToken: rawRefreshToken,
  };
};

/**
 * Rotates a refresh token and revokes all user tokens if reuse of a revoked token is detected.
 */
const refresh = async ({ rawRefreshToken, userAgent = null, ip = null }) => {
  if (!rawRefreshToken) {
    throw new AppError('Refresh token is missing.', 401);
  }

  const tokenHash = hashToken(rawRefreshToken);

  const existingToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!existingToken) {
    throw new AppError('Invalid refresh token.', 401);
  }

  // Reuse detection: a previously revoked token was presented again
  if (existingToken.revokedAt !== null) {
    logger.warn(
      { userId: existingToken.userId, tokenId: existingToken.id, ip },
      'Refresh token reuse detected! Revoking all active sessions for user.'
    );

    await prisma.refreshToken.updateMany({
      where: {
        userId: existingToken.userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    throw new AppError('Refresh token reuse detected. All sessions have been revoked.', 401);
  }

  if (existingToken.expiresAt <= new Date()) {
    await prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { revokedAt: new Date() },
    });
    throw new AppError('Refresh token has expired. Please log in again.', 401);
  }

  if (!existingToken.user || !existingToken.user.isActive) {
    throw new AppError('Account is inactive or no longer exists.', 403);
  }

  const newRawRefreshToken = generateRefreshToken();
  const newTokenHash = hashToken(newRawRefreshToken);
  const newAccessToken = generateAccessToken(existingToken.user);

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existingToken.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        userId: existingToken.userId,
        tokenHash: newTokenHash,
        expiresAt: getRefreshExpiryDate(),
        userAgent,
        ip,
      },
    }),
  ]);

  return {
    user: await formatUserWithAvatar(sanitizeUser(existingToken.user)),
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
  };
};

/**
 * Revokes the current refresh token if present.
 */
const logout = async ({ rawRefreshToken }) => {
  if (!rawRefreshToken) {
    return;
  }

  const tokenHash = hashToken(rawRefreshToken);

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

/**
 * Revokes all active refresh tokens for a given user.
 */
const logoutAll = async ({ userId }) => {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

/**
 * Fetches current user profile without passwordHash.
 */
const getMe = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_PUBLIC_SELECT,
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  return formatUserWithAvatar(user);
};

module.exports = {
  signup,
  login,
  refresh,
  logout,
  logoutAll,
  getMe,
  hashToken,
  USER_PUBLIC_SELECT,
};
