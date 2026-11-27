// server/src/index.js
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { prisma, checkDbConnection } = require('./config/db');
const { startExpiryCron } = require('./jobs/expireListings');
const storage = require('./services/storage');
const cache = require('./services/cache');

const PORT = config.port;

const startServer = async () => {
  try {
    // Check initial database connectivity
    const dbStatus = await checkDbConnection();
    if (dbStatus.status === 'connected') {
      logger.info({ latencyMs: dbStatus.latencyMs }, 'Successfully connected to PostgreSQL via Prisma');
    } else {
      logger.warn({ error: dbStatus.error }, 'PostgreSQL connection unavailable at boot; running in offline/degraded mode');
    }

    // Check Redis cache connectivity (fail open if unavailable)
    const redisStatus = await cache.getHealthStatus();
    if (redisStatus.status === 'connected') {
      logger.info({ latencyMs: redisStatus.latencyMs }, 'Successfully connected to Redis cache');
    } else {
      logger.warn({ error: redisStatus.error }, 'Redis cache unavailable at boot; failing open to PostgreSQL');
    }

    // Ensure cached product payloads never outlive presigned image URLs
    const maxProductCacheTtl = Math.max(
      config.cache.defaultTtlSeconds,
      config.cache.productDetailTtlSeconds
    );
    if (config.storage.signedUrlExpirySeconds <= maxProductCacheTtl + 60) {
      logger.warn(
        {
          signedUrlExpirySeconds: config.storage.signedUrlExpirySeconds,
          maxProductCacheTtl,
        },
        'SIGNED_URL_EXPIRY_SECONDS should exceed max product cache TTL by at least 60s to prevent expired cached image URLs'
      );
    }

    // Ensure object storage bucket exists in dev or fail fast in production
    try {
      await storage.ensureStorageReady();
    } catch (storageErr) {
      if (config.env === 'production') {
        logger.fatal({ err: storageErr }, 'Fatal: Object storage unreachable in production');
        process.exit(1);
      }
      logger.warn({ err: storageErr.message }, 'Object storage initialization warning in dev');
    }

    const expiryCronTask = startExpiryCron();

    const server = app.listen(PORT, () => {
      logger.info(`CampusX Server listening on port ${PORT} [${config.env}]`);
      logger.info(`Health check available at http://localhost:${PORT}/api/health`);
    });

    // Graceful shutdown handling
    const shutdown = async (signal) => {
      logger.info(`${signal} received. Initiating graceful shutdown...`);
      if (expiryCronTask) {
        expiryCronTask.stop();
      }
      server.close(async () => {
        logger.info('HTTP server closed.');
        try {
          await cache.disconnect();
          await prisma.$disconnect();
          logger.info('Prisma & Redis connections closed.');
        } catch (err) {
          logger.error({ err }, 'Error during DB/Redis disconnect');
        }
        process.exit(0);
      });

      // Force shutdown after 10s timeout
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start CampusX Server');
    process.exit(1);
  }
};

startServer();
