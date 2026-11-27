// server/src/modules/search/search.routes.js
const express = require('express');
const validate = require('../../middleware/validator');
const { searchLimiter } = require('../../middleware/security');
const { suggestValidation } = require('./search.validators');
const searchController = require('./search.controller');

const router = express.Router();

// GET /api/search/suggest?q=
router.get('/suggest', searchLimiter, validate(suggestValidation), searchController.suggest);

// GET /api/search/popular (and /api/search/suggest/popular alias)
router.get('/popular', searchLimiter, searchController.popular);
router.get('/suggest/popular', searchLimiter, searchController.popular);

module.exports = router;
