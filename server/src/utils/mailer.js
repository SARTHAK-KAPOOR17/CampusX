// server/src/utils/mailer.js
const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('./logger');
const AppError = require('./AppError');

const isSmtpConfigured = () => Boolean(config.smtp.host && config.smtp.host.trim());

const createTransporter = () => {
  const port = config.smtp.port || 587;
  const transportOptions = {
    host: config.smtp.host,
    port,
    secure: port === 465,
  };

  if (config.smtp.user && config.smtp.pass) {
    transportOptions.auth = {
      user: config.smtp.user,
      pass: config.smtp.pass,
    };
  }

  return nodemailer.createTransport(transportOptions);
};

const buildOtpEmailHtml = ({ otp, expiryMinutes }) => `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; background: #0f172a; color: #e2e8f0; border-radius: 12px;">
    <h2 style="margin: 0 0 12px; color: #60a5fa;">CampusX Student Verification</h2>
    <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
      Use the verification code below to verify your university email address on CampusX.
    </p>
    <div style="background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 18px; text-align: center; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #ffffff;">${otp}</span>
    </div>
    <p style="margin: 0; font-size: 12px; color: #94a3b8;">
      This code expires in <strong>${expiryMinutes} minutes</strong>. Never share it with anyone.
    </p>
  </div>
`;

/**
 * Sends a student verification OTP via Nodemailer SMTP, or logs to console in dev/test when SMTP is unconfigured.
 */
const sendVerificationOtp = async ({ to, otp, expiryMinutes }) => {
  if (!isSmtpConfigured()) {
    if (config.env === 'production') {
      throw new AppError('Email service is not configured.', 500);
    }
    // Never log OTP in production; log clearly in dev/test when no SMTP is configured
    logger.info({ to, otp, expiryMinutes }, 'CampusX Verification OTP (SMTP not configured)');
    if (config.env !== 'test') {
      console.log(`[CampusX Verification OTP] ${to} -> ${otp} (expires in ${expiryMinutes}m)`);
    }
    return { mode: 'console' };
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: 'Your CampusX Student Verification Code',
    text: `Your CampusX student verification code is ${otp}. It expires in ${expiryMinutes} minutes.`,
    html: buildOtpEmailHtml({ otp, expiryMinutes }),
  });

  return { mode: 'smtp' };
};

module.exports = {
  sendVerificationOtp,
  isSmtpConfigured,
};
