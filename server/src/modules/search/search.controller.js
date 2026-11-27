// server/src/modules/search/search.controller.js
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');
const searchService = require('./search.service');

const suggest = asyncHandler(async (req, res) => {
  const suggestions = await searchService.getSuggestions(req.query.q);
  return successResponse(res, { suggestions }, 'Search suggestions retrieved.', 200);
});

const popular = asyncHandler(async (req, res) => {
  const popularSearches = await searchService.getPopularSearches();
  return successResponse(
    res,
    { popular: popularSearches },
    'Popular searches retrieved.',
    200
  );
});

module.exports = {
  suggest,
  popular,
};
