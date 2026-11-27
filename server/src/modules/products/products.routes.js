// server/src/modules/products/products.routes.js
const express = require('express');
const multer = require('multer');
const validate = require('../../middleware/validator');
const {
  authenticate,
  optionalAuthenticate,
  requireVerifiedStudent,
} = require('../../middleware/auth');
const { uploadLimiter } = require('../../middleware/security');
const { MAX_IMAGE_SIZE_BYTES } = require('../../services/images');
const {
  createProductValidation,
  updateProductValidation,
  productIdValidation,
  sellerStatusValidation,
  listProductsValidation,
  listMyProductsValidation,
} = require('./products.validators');
const productsController = require('./products.controller');
const {
  productImagesParamValidation,
  deleteProductImageValidation,
  reorderProductImagesValidation,
} = require('../product-images/productImages.validators');
const productImagesController = require('../product-images/productImages.controller');

const router = express.Router();

const uploadProductImagesMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES, // 5MB max per file
    files: 6, // max 6 files per request
  },
});

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

// Product Images (owner only, stricter upload rate limit)
router.post(
  '/:id/images',
  authenticate,
  uploadLimiter,
  validate(productImagesParamValidation),
  uploadProductImagesMulter.array('images', 6),
  productImagesController.uploadImages
);

router.patch(
  '/:id/images/order',
  authenticate,
  validate(reorderProductImagesValidation),
  productImagesController.reorderImages
);

router.delete(
  '/:id/images/:imageId',
  authenticate,
  validate(deleteProductImageValidation),
  productImagesController.deleteImage
);

// Owner or ADMIN delete
router.delete(
  '/:id',
  authenticate,
  validate(productIdValidation),
  productsController.deleteProduct
);

module.exports = router;
