// server/src/jobs/expireListings.js
const cron = require('node-cron');
const config = require('../config');
const { prisma } = require('../config/db');
const cache = require('../services/cache');
const logger = require('../utils/logger');

/**
 * Marks ACTIVE non-deleted listings whose expiresAt has passed as EXPIRED.
 * Standalone exported function for direct unit testing.
 */
const expireOverdueListings = async (now = new Date()) => {
  const result = await prisma.product.updateMany({
    where: {
      status: 'ACTIVE',
      deletedAt: null,
      expiresAt: {
        lte: now,
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  if (result.count > 0) {
    await Promise.all([
      cache.bumpVersion('products:version'),
      cache.delByPrefix('search:suggest:'),
    ]);
  }

  return {
    expiredCount: result.count,
  };
};

/**
 * Starts the hourly listing expiry cron job when ENABLE_CRON is enabled.
 */
const startExpiryCron = () => {
  if (!config.cron.enabled) {
    logger.info('Listing expiry cron job is disabled (ENABLE_CRON=false or test mode).');
    return null;
  }

  const task = cron.schedule('0 * * * *', async () => {
    try {
      const { expiredCount } = await expireOverdueListings();
      if (expiredCount > 0) {
        logger.info({ expiredCount }, 'Hourly listing expiry job marked overdue listings EXPIRED');
      }
    } catch (err) {
      logger.error({ err }, 'Hourly listing expiry job failed');
    }
  });

  logger.info('Listing expiry cron job scheduled (hourly at minute 0).');
  return task;
};

module.exports = {
  expireOverdueListings,
  startExpiryCron,
};
