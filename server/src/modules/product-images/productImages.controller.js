// server/src/modules/product-images/productImages.controller.js
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');
const productImagesService = require('./productImages.service');

const uploadImages = asyncHandler(async (req, res) => {
  const images = await productImagesService.uploadProductImages(
    req.params.id,
    req.user.id,
    req.files
  );
  return successResponse(res, { images }, 'Product images uploaded successfully.', 201);
});

const deleteImage = asyncHandler(async (req, res) => {
  const images = await productImagesService.deleteProductImage(
    req.params.id,
    req.params.imageId,
    req.user.id
  );
  return successResponse(res, { images }, 'Product image deleted successfully.', 200);
});

const reorderImages = asyncHandler(async (req, res) => {
  const images = await productImagesService.reorderProductImages(
    req.params.id,
    req.user.id,
    req.body.imageIds
  );
  return successResponse(res, { images }, 'Product images reordered successfully.', 200);
});

module.exports = {
  uploadImages,
  deleteImage,
  reorderImages,
};
