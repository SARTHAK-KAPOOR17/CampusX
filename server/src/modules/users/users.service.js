// server/src/modules/users/users.service.js
const crypto = require('crypto');
const { prisma } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { sanitizePlainText } = require('../../utils/sanitize');
const { formatUserWithAvatar } = require('../../utils/userFormatter');
const {
  processImageVariants,
  uploadVariants,
  deleteVariants,
} = require('../../services/images');
const { USER_PUBLIC_SELECT } = require('../auth/auth.service');
const { invalidateAuthUserCache } = require('../../middleware/auth');
const cache = require('../../services/cache');

const PUBLIC_PROFILE_SELECT = {
  id: true,
  name: true,
  avatarKey: true,
  course: true,
  branch: true,
  year: true,
  bio: true,
  ratingAverage: true,
  ratingCount: true,
  isVerifiedStudent: true,
};

const getMyProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_PUBLIC_SELECT,
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  return formatUserWithAvatar(user);
};

const updateMyProfile = async (userId, payload) => {
  const updateData = {};

  if (payload.name !== undefined) {
    const cleanName = sanitizePlainText(payload.name);
    if (cleanName.length < 2 || cleanName.length > 80) {
      throw new AppError('Name must be between 2 and 80 characters.', 422);
    }
    updateData.name = cleanName;
  }

  if (payload.course !== undefined) {
    updateData.course =
      payload.course === null || payload.course === '' ? null : sanitizePlainText(payload.course);
  }

  if (payload.branch !== undefined) {
    updateData.branch =
      payload.branch === null || payload.branch === '' ? null : sanitizePlainText(payload.branch);
  }

  if (payload.year !== undefined) {
    updateData.year = payload.year === null || payload.year === '' ? null : Number(payload.year);
  }

  if (payload.bio !== undefined) {
    const cleanBio = payload.bio === null ? null : sanitizePlainText(payload.bio);
    if (cleanBio !== null && cleanBio.length > 300) {
      throw new AppError('Bio must be at most 300 characters.', 422);
    }
    updateData.bio = cleanBio === '' ? null : cleanBio;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: USER_PUBLIC_SELECT,
  });

  await Promise.all([
    invalidateAuthUserCache(userId),
    cache.bumpVersion('products:version'),
  ]);

  return formatUserWithAvatar(user);
};

/**
 * Optimizes avatar via sharp (EXIF stripped, 3 WebP variants), uploads to private object storage,
 * and deletes old avatar variant objects on replacement.
 */
const updateAvatar = async (userId, file) => {
  if (!file || !file.buffer) {
    throw new AppError('Avatar image file is required.', 400);
  }

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarKey: true },
  });

  if (!existing) {
    throw new AppError('User not found.', 404);
  }

  const processed = await processImageVariants(file.buffer);
  const imageId = crypto.randomUUID();
  const baseKey = `avatars/${userId}/${imageId}`;

  await uploadVariants(baseKey, processed.variants);

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { avatarKey: baseKey },
    select: USER_PUBLIC_SELECT,
  });

  if (existing.avatarKey) {
    await deleteVariants(existing.avatarKey);
  }

  await Promise.all([
    invalidateAuthUserCache(userId),
    cache.bumpVersion('products:version'),
  ]);

  return formatUserWithAvatar(updatedUser);
};

const getPublicProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_PROFILE_SELECT,
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  return formatUserWithAvatar(user);
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  updateAvatar,
  getPublicProfile,
  sanitizePlainText,
};
