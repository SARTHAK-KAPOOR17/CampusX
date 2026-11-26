// server/src/modules/categories/categories.routes.js
const express = require('express');
const categoriesController = require('./categories.controller');

const router = express.Router();

router.get('/', categoriesController.listCategories);

module.exports = router;
