// server/src/app.js
const express = require('express');
const { setupSecurityMiddleware } = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');
const { errorResponse } = require('./utils/response');
const healthRoutes = require('./modules/health/health.routes');

const app = express();

// Apply security middleware (Helmet, CORS, rate-limit, XSS, body limits)
setupSecurityMiddleware(app);

// Mount health routes (accessible at /api/health and /health for container probes)
app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'CampusX API',
    version: '1.0.0',
    status: 'online',
    docs: '/api/health',
  });
});

// 404 Handler
app.use((req, res) => {
  return errorResponse(res, `Route '${req.originalUrl}' not found`, 404);
});

// Central Error Handler
app.use(errorHandler);

module.exports = app;
