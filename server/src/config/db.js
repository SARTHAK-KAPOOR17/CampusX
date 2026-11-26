// server/src/config/db.js
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error', 'warn'],
  });
} else {
  // Prevent multiple instances during hot-reloading in dev/test
  if (!global.__campusx_prisma__) {
    global.__campusx_prisma__ = new PrismaClient({
      log: process.env.NODE_ENV === 'test' ? [] : ['query', 'error', 'warn'],
    });
  }
  prisma = global.__campusx_prisma__;
}

/**
 * Checks the database connection status and measures latency.
 * @returns {Promise<{ status: string, latencyMs: number, error?: string }>}
 */
const checkDbConnection = async () => {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    return {
      status: 'connected',
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    logger.warn({ err: error.message }, 'Database connection healthcheck failed');
    return {
      status: 'disconnected',
      latencyMs,
      error: error.message,
    };
  }
};

module.exports = {
  prisma,
  checkDbConnection,
};
