// server/src/modules/product-images/productImages.service.js
const crypto = require('crypto');
const { prisma } = require('../../config/db');
const AppError = require('../../utils/AppError');
const storage = require('../../services/storage');
const cache = require('../../services/cache');
const {
  processImageVariants,
  uploadVariants,
  deleteVariants,
  resolveVariantUrls,
  buildVariantKeys,
} = require('../../services/images');

const MAX_IMAGES_PER_PRODUCT = 8;
const MAX_FILES_PER_REQUEST = 6;
const UPLOAD_CONCURRENCY = 2;
const EDITABLE_STATUSES = ['DRAFT', 'ACTIVE', 'RESERVED'];

const invalidateListingImageCaches = async (productId) => {
  await Promise.all([
    cache.bumpVersion('products:version'),
    cache.del(`products:detail:${productId}`),
    cache.delByPrefix('search:suggest:'),
  ]);
};

/**
 * Processes an array with bounded concurrency.
 */
const mapWithConcurrency = async (items, concurrency, fn) => {
  const results = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor;
      cursor += 1;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
};

const formatProductImage = async (img) => {
  const urls = await resolveVariantUrls(img.storageKey);
  return {
    id: img.id,
    thumbUrl: urls.thumbUrl,
    mediumUrl: urls.mediumUrl,
    largeUrl: urls.largeUrl,
    blurDataUrl: img.blurDataUrl,
    isPrimary: img.isPrimary,
    position: img.position,
    width: img.width,
    height: img.height,
    sizeBytes: img.sizeBytes,
  };
};

const formatPrimaryImage = async (img) => {
  if (!img) return null;
  const keys = buildVariantKeys(img.storageKey);
  const [thumbUrl, mediumUrl] = await Promise.all([
    storage.getSignedReadUrl(keys.thumb),
    storage.getSignedReadUrl(keys.medium),
  ]);
  return {
    id: img.id,
    thumbUrl,
    mediumUrl,
    blurDataUrl: img.blurDataUrl,
  };
};

/**
 * Uploads up to 6 images per request (max 8 total per product), owner only.
 */
const uploadProductImages = async (productId, actorId, files = []) => {
  if (!Array.isArray(files) || files.length === 0) {
    throw new AppError('At least one image file is required.', 400);
  }

  if (files.length > MAX_FILES_PER_REQUEST) {
    throw new AppError(`You can upload at most ${MAX_FILES_PER_REQUEST} images per request.`, 400);
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: {
      id: true,
      sellerId: true,
      status: true,
      images: {
        orderBy: { position: 'asc' },
        select: { id: true, isPrimary: true, position: true },
      },
    },
  });

  if (!product) {
    throw new AppError('Product listing not found.', 404);
  }

  if (product.sellerId !== actorId) {
    throw new AppError('Forbidden: you can only upload images to your own listings.', 403);
  }

  if (!EDITABLE_STATUSES.includes(product.status)) {
    throw new AppError(
      `Cannot upload images while listing is in ${product.status} status.`,
      409
    );
  }

  const existingCount = product.images.length;
  if (existingCount + files.length > MAX_IMAGES_PER_PRODUCT) {
    throw new AppError(
      `A product can have at most ${MAX_IMAGES_PER_PRODUCT} images (currently has ${existingCount}).`,
      400
    );
  }

  const uploadedBaseKeys = [];
  let processedItems;

  try {
    processedItems = await mapWithConcurrency(files, UPLOAD_CONCURRENCY, async (file) => {
      const processed = await processImageVariants(file.buffer);
      const imageId = crypto.randomUUID();
      const baseKey = `products/${productId}/${imageId}`;

      await uploadVariants(baseKey, processed.variants);
      uploadedBaseKeys.push(baseKey);

      return {
        id: imageId,
        storageKey: baseKey,
        width: processed.width,
        height: processed.height,
        sizeBytes: processed.sizeBytes,
        blurDataUrl: processed.blurDataUrl,
      };
    });
  } catch (err) {
    // Roll back any storage objects uploaded earlier in the same batch
    await Promise.allSettled(uploadedBaseKeys.map((key) => deleteVariants(key)));
    throw err;
  }

  const hasPrimary = product.images.some((img) => img.isPrimary);

  const createdRows = await prisma.$transaction(
    processedItems.map((item, idx) =>
      prisma.productImage.create({
        data: {
          id: item.id,
          productId,
          storageKey: item.storageKey,
          position: existingCount + idx,
          isPrimary: !hasPrimary && idx === 0,
          width: item.width,
          height: item.height,
          sizeBytes: item.sizeBytes,
          blurDataUrl: item.blurDataUrl,
        },
      })
    )
  );

  await invalidateListingImageCaches(productId);
  return Promise.all(createdRows.map(formatProductImage));
};

/**
 * Deletes a single product image, removes its variants from storage,
 * normalizes positions, and promotes the next image to primary if needed.
 */
const deleteProductImage = async (productId, imageId, actorId) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: {
      id: true,
      sellerId: true,
      status: true,
      images: {
        orderBy: { position: 'asc' },
        select: { id: true, storageKey: true, isPrimary: true, position: true },
      },
    },
  });

  if (!product) {
    throw new AppError('Product listing not found.', 404);
  }

  if (product.sellerId !== actorId) {
    throw new AppError('Forbidden: you can only delete images from your own listings.', 403);
  }

  const target = product.images.find((img) => img.id === imageId);
  if (!target) {
    throw new AppError('Product image not found.', 404);
  }

  const remaining = product.images.filter((img) => img.id !== imageId);

  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } });

    for (let i = 0; i < remaining.length; i += 1) {
      const shouldBePrimary = target.isPrimary ? i === 0 : remaining[i].isPrimary;
      await tx.productImage.update({
        where: { id: remaining[i].id },
        data: {
          position: i,
          isPrimary: shouldBePrimary,
        },
      });
    }
  });

  await deleteVariants(target.storageKey);

  const updatedImages = await prisma.productImage.findMany({
    where: { productId },
    orderBy: { position: 'asc' },
  });

  await invalidateListingImageCaches(productId);
  return Promise.all(updatedImages.map(formatProductImage));
};

/**
 * Reorders product images and marks the first image as primary (cover).
 */
const reorderProductImages = async (productId, actorId, imageIds) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: {
      id: true,
      sellerId: true,
      images: {
        select: { id: true },
      },
    },
  });

  if (!product) {
    throw new AppError('Product listing not found.', 404);
  }

  if (product.sellerId !== actorId) {
    throw new AppError('Forbidden: you can only reorder images on your own listings.', 403);
  }

  const uniqueIds = new Set(imageIds);
  if (uniqueIds.size !== imageIds.length) {
    throw new AppError('imageIds cannot contain duplicate IDs.', 422);
  }

  const existingIds = new Set(product.images.map((img) => img.id));
  if (
    imageIds.length !== existingIds.size ||
    imageIds.some((id) => !existingIds.has(id))
  ) {
    throw new AppError(
      'imageIds must include every image currently attached to this listing.',
      400
    );
  }

  await prisma.$transaction(
    imageIds.map((id, idx) =>
      prisma.productImage.update({
        where: { id },
        data: {
          position: idx,
          isPrimary: idx === 0,
        },
      })
    )
  );

  const reordered = await prisma.productImage.findMany({
    where: { productId },
    orderBy: { position: 'asc' },
  });

  await invalidateListingImageCaches(productId);
  return Promise.all(reordered.map(formatProductImage));
};

/**
 * Standalone unit-testable cleanup function for orphaned storage objects.
 * Compares all objects under products/ and avatars/ against active DB references.
 */
const cleanupOrphanedObjects = async () => {
  const [productKeys, avatarKeys, dbImages, dbUsers] = await Promise.all([
    storage.listObjects('products/'),
    storage.listObjects('avatars/'),
    prisma.productImage.findMany({ select: { storageKey: true } }),
    prisma.user.findMany({ where: { avatarKey: { not: null } }, select: { avatarKey: true } }),
  ]);

  const validBaseKeys = new Set([
    ...dbImages.map((img) => img.storageKey),
    ...dbUsers.map((u) => u.avatarKey),
  ]);

  const allObjectKeys = [...productKeys, ...avatarKeys];
  const orphanObjectKeys = allObjectKeys.filter((fullKey) => {
    const parts = fullKey.split('/');
    // Expected layout: products/{productId}/{imageId}/{variant}.webp or avatars/{userId}/{imageId}/{variant}.webp
    if (parts.length < 4) return false;
    const baseKey = parts.slice(0, 3).join('/');
    return !validBaseKeys.has(baseKey);
  });

  if (orphanObjectKeys.length > 0) {
    await storage.deleteObjects(orphanObjectKeys);
  }

  return {
    scannedObjects: allObjectKeys.length,
    orphanedObjectsDeleted: orphanObjectKeys.length,
  };
};

module.exports = {
  MAX_IMAGES_PER_PRODUCT,
  MAX_FILES_PER_REQUEST,
  formatProductImage,
  formatPrimaryImage,
  uploadProductImages,
  deleteProductImage,
  reorderProductImages,
  cleanupOrphanedObjects,
};
