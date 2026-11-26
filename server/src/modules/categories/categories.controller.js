// server/src/modules/categories/categories.controller.js
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');
const categoriesService = require('./categories.service');

const listCategories = asyncHandler(async (req, res) => {
  const categories = await categoriesService.listCategories();
  return successResponse(res, { categories }, 'Categories retrieved successfully.', 200);
});

module.exports = {
  listCategories,
};
