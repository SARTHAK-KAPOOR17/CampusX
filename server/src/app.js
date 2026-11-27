// server/src/app.js
const express = require('express');
const cookieParser = require('cookie-parser');
const { setupSecurityMiddleware } = require('./middleware/security');
const errorHandler = require('./middleware/errorHandler');
const { errorResponse } = require('./utils/response');
const healthRoutes = require('./modules/health/health.routes');
const authRoutes = require('./modules/auth/auth.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const verificationRoutes = require('./modules/verification/verification.routes');
const userRoutes = require('./modules/users/users.routes');
const categoryRoutes = require('./modules/categories/categories.routes');
const productRoutes = require('./modules/products/products.routes');
const searchRoutes = require('./modules/search/search.routes');

const app = express();

// Apply security middleware (Helmet, CORS, rate-limit, XSS, body limits)
setupSecurityMiddleware(app);

// Parse HTTP-only cookies for refresh token flows
app.use(cookieParser());

// Mount routes
app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/search', searchRoutes);

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
