// server/src/modules/users/users.service.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { prisma } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { sanitizePlainText } = require('../../utils/sanitize');
const { USER_PUBLIC_SELECT } = require('../auth/auth.service');

const AVATARS_DIR = path.resolve(__dirname, '../../../uploads/avatars');

const PUBLIC_PROFILE_SELECT = {
  id: true,
  name: true,
  profilePictureUrl: true,
  course: true,
  branch: true,
  year: true,
  bio: true,
  ratingAverage: true,
  ratingCount: true,
  isVerifiedStudent: true,
};

/**
 * Validates actual image binary signature (magic bytes) for JPEG, PNG, and WebP.
 */
const detectImageTypeByMagicBytes = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: '.jpg', mime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (pngSig.every((byte, idx) => buffer[idx] === byte)) {
    return { ext: '.png', mime: 'image/png' };
  }

  // WebP: "RIFF" at 0..3 and "WEBP" at 8..11
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { ext: '.webp', mime: 'image/webp' };
  }

  return null;
};

const deleteLocalAvatarIfExists = async (profilePictureUrl) => {
  if (!profilePictureUrl || !profilePictureUrl.startsWith('/uploads/avatars/')) {
    return;
  }

  const filename = path.basename(profilePictureUrl);
  const fullPath = path.join(AVATARS_DIR, filename);

  try {
    await fs.promises.unlink(fullPath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }
};

const getMyProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: USER_PUBLIC_SELECT,
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  return user;
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
    updateData.course = payload.course === null || payload.course === '' ? null : sanitizePlainText(payload.course);
  }

  if (payload.branch !== undefined) {
    updateData.branch = payload.branch === null || payload.branch === '' ? null : sanitizePlainText(payload.branch);
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

  return user;
};

const updateAvatar = async (userId, file) => {
  if (!file || !file.buffer) {
    throw new AppError('Avatar image file is required.', 400);
  }

  const detected = detectImageTypeByMagicBytes(file.buffer);
  if (!detected) {
    throw new AppError(
      'Invalid image file. Only genuine JPEG, PNG, and WebP images are allowed.',
      400
    );
  }

  // TODO: Day 5 will migrate avatar storage from local disk to cloud storage (S3 / R2).
  await fs.promises.mkdir(AVATARS_DIR, { recursive: true });

  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { profilePictureUrl: true },
  });

  if (!existing) {
    throw new AppError('User not found.', 404);
  }

  const filename = `${crypto.randomUUID()}${detected.ext}`;
  const destination = path.join(AVATARS_DIR, filename);
  await fs.promises.writeFile(destination, file.buffer);

  const profilePictureUrl = `/uploads/avatars/${filename}`;

  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { profilePictureUrl },
    select: USER_PUBLIC_SELECT,
  });

  // Delete previous local avatar after DB update succeeds
  await deleteLocalAvatarIfExists(existing.profilePictureUrl);

  return updatedUser;
};

const getPublicProfile = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_PROFILE_SELECT,
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  return user;
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  updateAvatar,
  getPublicProfile,
  detectImageTypeByMagicBytes,
  sanitizePlainText,
  AVATARS_DIR,
};
