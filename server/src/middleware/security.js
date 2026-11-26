// server/src/middleware/security.js
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const express = require('express');
const config = require('../config');
const { errorResponse } = require('../utils/response');

/**
 * Custom XSS Sanitizer: strips script tags and dangerous HTML entities recursively
 */
const sanitizeXss = (obj) => {
  if (!obj || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/javascript:/gi, '');
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeXss);
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeXss(value);
  }
  return sanitized;
};

const xssProtectionMiddleware = (req, res, next) => {
  if (req.body) req.body = sanitizeXss(req.body);
  if (req.query) req.query = sanitizeXss(req.query);
  if (req.params) req.params = sanitizeXss(req.params);
  next();
};

/**
 * General API rate limiter
 */
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.env === 'test' ? 1000 : config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(res, 'Too many requests from this IP, please try again later.', 429);
  },
});

/**
 * Stricter rate limiter for sensitive auth endpoints (/signup, /login, /refresh)
 */
const authLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.env === 'test' ? 1000 : config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return errorResponse(
      res,
      'Too many authentication attempts from this IP, please try again later.',
      429
    );
  },
});

/**
 * CORS options with dynamic whitelist verification
 */
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (config.corsOrigins.includes(origin) || config.corsOrigins.includes('*')) {
      return callback(null, true);
    }
    return callback(new Error(`Origin '${origin}' not allowed by CORS policy`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

/**
 * Apply all security middleware to the Express app
 */
const setupSecurityMiddleware = (app) => {
  // 1. Helmet headers (allow cross-origin static avatar loading from client origin)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // 2. CORS configuration
  app.use(cors(corsOptions));

  // 3. Body size limits
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));

  // 4. XSS sanitization
  app.use(xssProtectionMiddleware);

  // 5. Rate limiting on API routes
  app.use('/api', limiter);
};

module.exports = {
  setupSecurityMiddleware,
  limiter,
  authLimiter,
  xssProtectionMiddleware,
};
