// server/src/modules/product-images/productImages.validators.js
const { body, param } = require('express-validator');

const productImagesParamValidation = [
  param('id').isUUID().withMessage('Invalid product ID format'),
];

const deleteProductImageValidation = [
  param('id').isUUID().withMessage('Invalid product ID format'),
  param('imageId').isUUID().withMessage('Invalid image ID format'),
];

const reorderProductImagesValidation = [
  param('id').isUUID().withMessage('Invalid product ID format'),
  body('imageIds')
    .isArray({ min: 1, max: 8 })
    .withMessage('imageIds must be a non-empty array of image IDs'),
  body('imageIds.*').isUUID().withMessage('Each imageId must be a valid UUID'),
];

module.exports = {
  productImagesParamValidation,
  deleteProductImageValidation,
  reorderProductImagesValidation,
};
