// server/src/config/index.js
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://campusx_user:campusx_password@localhost:5432/campusx_db?schema=public',
  corsOrigins: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['http://localhost:5173', 'http://localhost:3000'],
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10),
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10),
    uploadWindowMs: parseInt(process.env.UPLOAD_RATE_LIMIT_WINDOW_MS || '900000', 10),
    uploadMax: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || '30', 10),
  },
  bodyLimit: process.env.BODY_LIMIT || '10mb',
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET ||
      (process.env.NODE_ENV === 'test' ? 'campusx-test-access-secret' : 'campusx-dev-access-secret'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresDays: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS || '7', 10),
  },
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  verification: {
    allowedDomains: (
      process.env.ALLOWED_COLLEGE_DOMAINS ||
      'campusx.edu,university.edu,mit.edu,stanford.edu,iitd.ac.in'
    )
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
    otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'CampusX <noreply@campusx.edu>',
  },
  listings: {
    expiryDays: parseInt(process.env.LISTING_EXPIRY_DAYS || '60', 10),
  },
  cron: {
    enabled: process.env.ENABLE_CRON !== 'false' && process.env.NODE_ENV !== 'test',
  },
  storage: {
    endpoint: process.env.STORAGE_ENDPOINT || 'http://localhost:9000',
    publicEndpoint: process.env.STORAGE_PUBLIC_ENDPOINT || '',
    region: process.env.STORAGE_REGION || 'us-east-1',
    bucket: process.env.STORAGE_BUCKET || 'campusx-media',
    accessKey: process.env.STORAGE_ACCESS_KEY || '',
    secretKey: process.env.STORAGE_SECRET_KEY || '',
    forcePathStyle: process.env.STORAGE_FORCE_PATH_STYLE === 'true',
    cdnBaseUrl: (process.env.CDN_BASE_URL || '').replace(/\/+$/, ''),
    signedUrlExpirySeconds: parseInt(process.env.SIGNED_URL_EXPIRY_SECONDS || '900', 10),
  },
};

module.exports = config;
