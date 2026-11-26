// server/src/modules/products/products.routes.js
const express = require('express');
const validate = require('../../middleware/validator');
const {
  authenticate,
  optionalAuthenticate,
  requireVerifiedStudent,
} = require('../../middleware/auth');
const {
  createProductValidation,
  updateProductValidation,
  productIdValidation,
  sellerStatusValidation,
  listProductsValidation,
  listMyProductsValidation,
} = require('./products.validators');
const productsController = require('./products.controller');

const router = express.Router();

// Seller's own listings (must be registered BEFORE /:id)
router.get(
  '/mine',
  authenticate,
  validate(listMyProductsValidation),
  productsController.listMyProducts
);

// Public marketplace feed & detail
router.get('/', validate(listProductsValidation), productsController.listPublicProducts);
router.get(
  '/:id',
  optionalAuthenticate,
  validate(productIdValidation),
  productsController.getProductById
);

// Create listing (verified students only)
router.post(
  '/',
  authenticate,
  requireVerifiedStudent,
  validate(createProductValidation),
  productsController.createProduct
);

// Owner-only edits & lifecycle transitions
router.patch(
  '/:id',
  authenticate,
  validate(updateProductValidation),
  productsController.updateProduct
);

router.post(
  '/:id/publish',
  authenticate,
  validate(productIdValidation),
  productsController.publishProduct
);

router.post(
  '/:id/status',
  authenticate,
  validate(sellerStatusValidation),
  productsController.updateSellerStatus
);

// Owner or ADMIN delete
router.delete(
  '/:id',
  authenticate,
  validate(productIdValidation),
  productsController.deleteProduct
);

module.exports = router;
