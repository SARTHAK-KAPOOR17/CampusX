// server/src/modules/admin/admin.service.js
const { prisma } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { formatUserWithAvatar, formatUsersWithAvatar } = require('../../utils/userFormatter');
const { USER_PUBLIC_SELECT } = require('../auth/auth.service');
const { invalidateAuthUserCache } = require('../../middleware/auth');
const cache = require('../../services/cache');

/**
 * Returns paginated list of users without passwordHash.
 */
const listUsers = async ({ page = 1, limit = 10 }) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const skip = (safePage - 1) * safeLimit;

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      select: USER_PUBLIC_SELECT,
    }),
    prisma.user.count(),
  ]);

  return {
    users: await formatUsersWithAvatar(users),
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

/**
 * Updates a user's role and immediately invalidates their cached auth entry.
 */
const updateUserRole = async ({ actorId, targetUserId, role }) => {
  if (actorId === targetUserId && role !== 'ADMIN') {
    throw new AppError('Admins cannot demote themselves.', 400);
  }

  const existing = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError('User not found.', 404);
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { role },
    select: USER_PUBLIC_SELECT,
  });

  await invalidateAuthUserCache(targetUserId);
  return formatUserWithAvatar(updatedUser);
};

/**
 * Activates or deactivates a user account and invalidates cached auth/product feeds immediately.
 */
const updateUserStatus = async ({ actorId, targetUserId, isActive }) => {
  if (actorId === targetUserId && !isActive) {
    throw new AppError('Admins cannot deactivate their own account.', 400);
  }

  const existing = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError('User not found.', 404);
  }

  const updatedUser = await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive: Boolean(isActive) },
    select: USER_PUBLIC_SELECT,
  });

  await Promise.all([
    invalidateAuthUserCache(targetUserId),
    cache.bumpVersion('products:version'),
  ]);

  return formatUserWithAvatar(updatedUser);
};

module.exports = {
  listUsers,
  updateUserRole,
  updateUserStatus,
};
