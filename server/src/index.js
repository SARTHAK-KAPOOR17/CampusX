// server/src/index.js
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const { prisma, checkDbConnection } = require('./config/db');
const { startExpiryCron } = require('./jobs/expireListings');

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
          await prisma.$disconnect();
          logger.info('Prisma disconnected from database.');
        } catch (err) {
          logger.error({ err }, 'Error during Prisma disconnect');
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
