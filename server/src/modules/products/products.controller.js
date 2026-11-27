// server/src/modules/products/products.controller.js
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');
const productsService = require('./products.service');

const createProduct = asyncHandler(async (req, res) => {
  const product = await productsService.createProduct(req.user.id, req.body);
  const message =
    product.status === 'DRAFT'
      ? 'Listing saved as draft.'
      : 'Listing published successfully.';
  return successResponse(res, { product }, message, 201);
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await productsService.updateProduct(req.params.id, req.user.id, req.body);
  return successResponse(res, { product }, 'Listing updated successfully.', 200);
});

const publishProduct = asyncHandler(async (req, res) => {
  const product = await productsService.publishProduct(req.params.id, req.user.id);
  return successResponse(res, { product }, 'Listing published successfully.', 200);
});

const updateSellerStatus = asyncHandler(async (req, res) => {
  const product = await productsService.updateSellerStatus(
    req.params.id,
    req.user.id,
    req.body.status
  );
  return successResponse(res, { product }, 'Listing status updated successfully.', 200);
});

const updateModeratorStatus = asyncHandler(async (req, res) => {
  const product = await productsService.updateModeratorStatus(req.params.id, req.body.status);
  return successResponse(res, { product }, 'Moderation status updated successfully.', 200);
});

const deleteProduct = asyncHandler(async (req, res) => {
  const result = await productsService.deleteProduct(req.params.id, req.user);
  return successResponse(res, result, 'Listing deleted successfully.', 200);
});

const getProductById = asyncHandler(async (req, res) => {
  const product = await productsService.getProductById(req.params.id, req.user);
  return successResponse(res, { product }, 'Listing retrieved successfully.', 200);
});

const listPublicProducts = asyncHandler(async (req, res) => {
  const result = await productsService.listPublicProducts({
    q: req.query.q,
    page: req.query.page,
    limit: req.query.limit,
    categoryId: req.query.categoryId,
    category: req.query.category,
    minPrice: req.query.minPrice,
    maxPrice: req.query.maxPrice,
    condition: req.query.condition,
    availability: req.query.availability,
    isNegotiable: req.query.isNegotiable,
    verifiedSeller: req.query.verifiedSeller,
    sort: req.query.sort,
    clientIp: req.ip,
    onCacheStatus: (status) => res.set('X-Cache', status),
  });
  return successResponse(res, result, 'Marketplace listings retrieved.', 200);
});

const listMyProducts = asyncHandler(async (req, res) => {
  const result = await productsService.listMyProducts(req.user.id, {
    page: req.query.page,
    limit: req.query.limit,
    status: req.query.status,
  });
  return successResponse(res, result, 'Your listings retrieved.', 200);
});

module.exports = {
  createProduct,
  updateProduct,
  publishProduct,
  updateSellerStatus,
  updateModeratorStatus,
  deleteProduct,
  getProductById,
  listPublicProducts,
  listMyProducts,
};
