// server/src/middleware/security.js
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { MemoryStore } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const express = require('express');
const config = require('../config');
const cache = require('../services/cache');
const logger = require('../utils/logger');
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
 * Express-rate-limit Store backed by RedisStore for multi-instance sharing,
 * failing open automatically to an internal MemoryStore whenever Redis is unavailable.
 */
class ResilientRedisRateLimitStore {
  constructor({ prefix }) {
    this.localKeys = false;
    this.prefix = `${cache.namespacePrefix()}rl:${prefix}:`;
    this.options = null;
    this.memoryStore = new MemoryStore();
    this.redisStore = null;
  }

  init(options) {
    this.options = options;
    this.memoryStore.init(options);
  }

  _ensureRedisStore() {
    if (!cache.isReady()) return null;
    if (!this.redisStore) {
      this.redisStore = new RedisStore({
        prefix: this.prefix,
        sendCommand: async (...args) => {
          const client = cache.getClient();
          if (!client || client.status !== 'ready') {
            throw new Error('Redis unavailable for rate limiting');
          }
          return client.call(...args);
        },
      });
      if (this.options && typeof this.redisStore.init === 'function') {
        this.redisStore.init(this.options);
      }
    }
    return this.redisStore;
  }

  async increment(key) {
    const store = this._ensureRedisStore();
    if (!store) {
      return this.memoryStore.increment(key);
    }
    try {
      return await store.increment(key);
    } catch (err) {
      this.redisStore = null;
      logger.warn({ err: err.message }, 'Redis rate limit store failed; falling back to memory');
      return this.memoryStore.increment(key);
    }
  }

  async decrement(key) {
    const store = this._ensureRedisStore();
    if (!store) {
      return this.memoryStore.decrement(key);
    }
    try {
      return await store.decrement(key);
    } catch {
      return this.memoryStore.decrement(key);
    }
  }

  async resetKey(key) {
    const store = this._ensureRedisStore();
    await Promise.allSettled([
      this.memoryStore.resetKey(key),
      store ? store.resetKey(key) : Promise.resolve(),
    ]);
  }
}

const createRateLimiter = ({ windowMs, max, prefix, message, skipInTest = true }) =>
  rateLimit({
    windowMs,
    max: skipInTest && config.env === 'test' ? 1000 : max,
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    store: new ResilientRedisRateLimitStore({ prefix }),
    handler: (req, res) => errorResponse(res, message, 429),
  });

/**
 * General API rate limiter
 */
const limiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  prefix: 'general',
  message: 'Too many requests from this IP, please try again later.',
});

/**
 * Stricter rate limiter for sensitive auth endpoints (/signup, /login, /refresh)
 */
const authLimiter = createRateLimiter({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMax,
  prefix: 'auth',
  message: 'Too many authentication attempts from this IP, please try again later.',
});

/**
 * Stricter rate limiter for image upload endpoints
 */
const uploadLimiter = createRateLimiter({
  windowMs: config.rateLimit.uploadWindowMs,
  max: config.rateLimit.uploadMax,
  prefix: 'upload',
  message: 'Too many file upload requests from this IP, please try again later.',
});

/**
 * Search/autocomplete rate limiter (debounce-friendly)
 */
const searchLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  prefix: 'search',
  message: 'Too many search requests from this IP, please slow down.',
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
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/client'],
          frameSrc: ["'self'", 'https://accounts.google.com/gsi/', 'https://accounts.google.com/'],
          connectSrc: ["'self'", 'https://accounts.google.com/gsi/'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:', 'http:'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com/gsi/style'],
        },
      },
    })
  );
  app.use(cors(corsOptions));
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));
  app.use(xssProtectionMiddleware);
  app.use('/api', limiter);
};

module.exports = {
  setupSecurityMiddleware,
  xssProtectionMiddleware,
  ResilientRedisRateLimitStore,
  createRateLimiter,
  limiter,
  authLimiter,
  uploadLimiter,
  searchLimiter,
};
