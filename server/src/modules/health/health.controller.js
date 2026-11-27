// server/src/modules/health/health.controller.js
const { checkDbConnection } = require('../../config/db');
const cache = require('../../services/cache');
const { successResponse } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * Controller to handle GET /api/health and GET /health
 */
const getHealth = asyncHandler(async (req, res) => {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDbConnection(),
    cache.getHealthStatus(),
  ]);

  const healthData = {
    service: 'campusx-server',
    status: dbHealth.status === 'connected' ? 'healthy' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    database: dbHealth,
    redis: redisHealth,
    system: {
      memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      nodeVersion: process.version,
    },
  };

  return successResponse(res, healthData, 'CampusX API Health Check', 200);
});

module.exports = {
  getHealth,
};
