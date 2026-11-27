// server/src/modules/verification/verification.service.js
const crypto = require('crypto');
const config = require('../../config');
const { prisma } = require('../../config/db');
const AppError = require('../../utils/AppError');
const mailer = require('../../utils/mailer');
const { formatUserWithAvatar } = require('../../utils/userFormatter');
const { USER_PUBLIC_SELECT } = require('../auth/auth.service');
const { invalidateAuthUserCache } = require('../../middleware/auth');
const cache = require('../../services/cache');

const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 5;
const MAX_OTP_ATTEMPTS = 5;
const COLLEGE_EMAIL_ERROR = 'Please use your college email ending with @chitkara.edu.in';
const LOCAL_PART_REGEX = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i;

const hashOtp = (otp) => {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
};

/**
 * Strictly validates and normalizes a college email against ALLOWED_COLLEGE_DOMAINS.
 * Requires exact domain equality (no endsWith/contains/subdomain match).
 */
const validateAndNormalizeCollegeEmail = (
  rawEmail,
  allowedDomains = config.verification.allowedDomains
) => {
  if (typeof rawEmail !== 'string') {
    return { valid: false, normalized: '', domain: '' };
  }

  const normalized = rawEmail.trim().toLowerCase();
  if (!normalized || normalized.length > 254) {
    return { valid: false, normalized, domain: '' };
  }

  const parts = normalized.split('@');
  if (parts.length !== 2) {
    return { valid: false, normalized, domain: '' };
  }

  const [localPart, domain] = parts;
  if (
    !localPart ||
    localPart.length > 64 ||
    /\s/.test(localPart) ||
    !LOCAL_PART_REGEX.test(localPart) ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..')
  ) {
    return { valid: false, normalized, domain };
  }

  if (!domain || !allowedDomains.includes(domain)) {
    return { valid: false, normalized, domain };
  }

  return { valid: true, normalized, domain };
};

/**
 * Generates and emails a 6-digit OTP to a valid college email.
 */
const requestOtp = async ({ userId, collegeEmail }) => {
  const { valid, normalized: normalizedCollegeEmail } = validateAndNormalizeCollegeEmail(collegeEmail);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isVerifiedStudent: true },
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  if (user.isVerifiedStudent) {
    throw new AppError('Your student account is already verified.', 400);
  }

  if (!valid) {
    throw new AppError(COLLEGE_EMAIL_ERROR, 400);
  }

  // Case-insensitive duplicate check: reject if verified by another user
  const verifiedByOther = await prisma.user.findFirst({
    where: {
      collegeEmail: { equals: normalizedCollegeEmail, mode: 'insensitive' },
      id: { not: userId },
    },
    select: { id: true },
  });

  if (verifiedByOther) {
    throw new AppError('This college email is already verified by another account.', 409);
  }

  // Enforce 60-second resend cooldown
  const latestOtp = await prisma.emailOtp.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  if (latestOtp) {
    const elapsedMs = Date.now() - latestOtp.createdAt.getTime();
    if (elapsedMs < RESEND_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsedMs) / 1000);
      throw new AppError(
        `Please wait ${waitSeconds} second(s) before requesting another verification code.`,
        429
      );
    }
  }

  // Enforce max 5 requests per hour per user
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await prisma.emailOtp.count({
    where: {
      userId,
      createdAt: { gte: oneHourAgo },
    },
  });

  if (recentCount >= MAX_REQUESTS_PER_HOUR) {
    throw new AppError(
      'Maximum of 5 verification requests per hour reached. Please try again later.',
      429
    );
  }

  const otp = crypto.randomInt(100000, 1000000).toString();
  const otpHash = hashOtp(otp);
  const expiryMinutes = config.verification.otpExpiryMinutes;
  const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

  await prisma.$transaction([
    prisma.emailOtp.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.emailOtp.create({
      data: {
        userId,
        collegeEmail: normalizedCollegeEmail,
        otpHash,
        expiresAt,
      },
    }),
  ]);

  await mailer.sendVerificationOtp({
    to: normalizedCollegeEmail,
    otp,
    expiryMinutes,
  });

  return {
    collegeEmail: normalizedCollegeEmail,
    expiresAt,
    cooldownSeconds: 60,
  };
};

/**
 * Verifies a submitted 6-digit OTP using constant-time comparison and marks user as verified.
 */
const confirmOtp = async ({ userId, otp }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isVerifiedStudent: true },
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  if (user.isVerifiedStudent) {
    throw new AppError('Your student account is already verified.', 400);
  }

  const activeOtp = await prisma.emailOtp.findFirst({
    where: { userId, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!activeOtp) {
    throw new AppError('No active verification OTP found. Please request a new code.', 400);
  }

  if (activeOtp.expiresAt <= new Date()) {
    await prisma.emailOtp.update({
      where: { id: activeOtp.id },
      data: { consumedAt: new Date() },
    });
    throw new AppError('Verification OTP has expired. Please request a new code.', 400);
  }

  if (activeOtp.attempts >= MAX_OTP_ATTEMPTS) {
    await prisma.emailOtp.update({
      where: { id: activeOtp.id },
      data: { consumedAt: new Date() },
    });
    throw new AppError('Maximum OTP verification attempts exceeded. Please request a new code.', 400);
  }

  const submittedHash = hashOtp(otp.trim());
  const submittedBuf = Buffer.from(submittedHash, 'hex');
  const storedBuf = Buffer.from(activeOtp.otpHash, 'hex');
  const isValid =
    submittedBuf.length === storedBuf.length && crypto.timingSafeEqual(submittedBuf, storedBuf);

  if (!isValid) {
    const nextAttempts = activeOtp.attempts + 1;
    const lockedOut = nextAttempts >= MAX_OTP_ATTEMPTS;

    await prisma.emailOtp.update({
      where: { id: activeOtp.id },
      data: {
        attempts: nextAttempts,
        ...(lockedOut ? { consumedAt: new Date() } : {}),
      },
    });

    if (lockedOut) {
      throw new AppError(
        'Too many wrong OTP attempts. This code has been invalidated; please request a new one.',
        400
      );
    }

    throw new AppError(
      `Invalid verification code. ${MAX_OTP_ATTEMPTS - nextAttempts} attempt(s) remaining.`,
      400
    );
  }

  const normalizedOtpEmail = String(activeOtp.collegeEmail || '').trim().toLowerCase();

  const verifiedByOther = await prisma.user.findFirst({
    where: {
      collegeEmail: { equals: normalizedOtpEmail, mode: 'insensitive' },
      id: { not: userId },
    },
    select: { id: true },
  });

  if (verifiedByOther) {
    throw new AppError('This college email is already verified by another account.', 409);
  }

  const now = new Date();
  const [, updatedUser] = await prisma.$transaction([
    prisma.emailOtp.update({
      where: { id: activeOtp.id },
      data: { consumedAt: now },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        isVerifiedStudent: true,
        verifiedAt: now,
        collegeEmail: normalizedOtpEmail,
      },
      select: USER_PUBLIC_SELECT,
    }),
  ]);

  await Promise.all([
    invalidateAuthUserCache(userId),
    cache.bumpVersion('products:version'),
  ]);

  return formatUserWithAvatar(updatedUser);
};

/**
 * Returns student verification status for the authenticated user.
 */
const getStatus = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isVerifiedStudent: true,
      collegeEmail: true,
      verifiedAt: true,
    },
  });

  if (!user) {
    throw new AppError('User not found.', 404);
  }

  return user;
};

module.exports = {
  requestOtp,
  confirmOtp,
  getStatus,
  hashOtp,
  validateAndNormalizeCollegeEmail,
  COLLEGE_EMAIL_ERROR,
};
