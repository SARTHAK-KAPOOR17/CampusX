// server/src/modules/verification/verification.service.js
const crypto = require('crypto');
const config = require('../../config');
const { prisma } = require('../../config/db');
const AppError = require('../../utils/AppError');
const mailer = require('../../utils/mailer');
const { formatUserWithAvatar } = require('../../utils/userFormatter');
const { USER_PUBLIC_SELECT } = require('../auth/auth.service');

const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_REQUESTS_PER_HOUR = 5;
const MAX_OTP_ATTEMPTS = 5;

const hashOtp = (otp) => {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
};

const extractDomain = (email) => {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : '';
};

const isAllowedCollegeDomain = (domain) => {
  return config.verification.allowedDomains.includes(domain);
};

/**
 * Generates and emails a 6-digit OTP to a valid college email.
 */
const requestOtp = async ({ userId, collegeEmail }) => {
  const normalizedCollegeEmail = collegeEmail.trim().toLowerCase();
  const domain = extractDomain(normalizedCollegeEmail);

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

  if (!domain || !isAllowedCollegeDomain(domain)) {
    throw new AppError(
      `Email domain '${domain || 'unknown'}' is not in the allowed college domains list.`,
      400
    );
  }

  // Reject if this college email is already verified by another user
  const verifiedByOther = await prisma.user.findFirst({
    where: {
      collegeEmail: normalizedCollegeEmail,
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

  const verifiedByOther = await prisma.user.findFirst({
    where: {
      collegeEmail: activeOtp.collegeEmail,
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
        collegeEmail: activeOtp.collegeEmail,
      },
      select: USER_PUBLIC_SELECT,
    }),
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
};
