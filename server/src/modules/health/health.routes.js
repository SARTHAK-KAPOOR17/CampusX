// server/src/modules/health/health.routes.js
const express = require('express');
const { getHealth } = require('./health.controller');

const router = express.Router();

// GET /api/health and /health
router.get('/', getHealth);

module.exports = router;
