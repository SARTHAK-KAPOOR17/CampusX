// server/src/modules/products/products.service.js
const { Prisma } = require('@prisma/client');
const config = require('../../config');
const { prisma } = require('../../config/db');
const AppError = require('../../utils/AppError');
const { sanitizePlainText } = require('../../utils/sanitize');

const EDITABLE_STATUSES = ['DRAFT', 'ACTIVE', 'RESERVED'];
const PUBLIC_VISIBLE_STATUSES = ['ACTIVE', 'RESERVED', 'SOLD'];
const FEED_STATUSES = ['ACTIVE', 'RESERVED'];

/**
 * Central Listing Lifecycle Transition Map
 * Single source of truth for all seller and moderator status transitions.
 */
const TRANSITION_MAP = {
  seller: {
    DRAFT: ['ACTIVE'], // only via publish endpoint or explicit publish helper
    ACTIVE: ['RESERVED', 'SOLD'],
    RESERVED: ['ACTIVE', 'SOLD'],
    EXPIRED: ['ACTIVE'], // relist
    SOLD: [],
    UNDER_REVIEW: [],
  },
  moderator: {
    DRAFT: [],
    ACTIVE: ['UNDER_REVIEW'],
    RESERVED: ['UNDER_REVIEW'],
    SOLD: [],
    EXPIRED: [],
    UNDER_REVIEW: ['ACTIVE'],
  },
};

const SELLER_PUBLIC_SELECT = {
  id: true,
  name: true,
  profilePictureUrl: true,
  isVerifiedStudent: true,
  ratingAverage: true,
};

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
};

const PRODUCT_INCLUDE = {
  seller: { select: SELLER_PUBLIC_SELECT },
  category: { select: CATEGORY_SELECT },
};

const formatProduct = (product) => {
  if (!product) return null;
  return {
    ...product,
    price: product.price !== null && product.price !== undefined ? Number(product.price) : null,
  };
};

const sanitizeTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const seen = new Set();
  const cleaned = [];
  for (const tag of tags) {
    const clean = sanitizePlainText(tag).slice(0, 30);
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      cleaned.push(clean);
    }
    if (cleaned.length >= 10) break;
  }
  return cleaned;
};

const toDecimalPrice = (price) => {
  if (price === null || price === undefined || price === '') return null;
  const num = Number(price);
  if (!Number.isFinite(num) || num < 0 || num > 99999999.99) {
    throw new AppError('Invalid price value.', 422);
  }
  return new Prisma.Decimal(num.toFixed(2));
};

const getExpiresAt = (fromDate = new Date()) => {
  const expiresAt = new Date(fromDate);
  expiresAt.setDate(expiresAt.getDate() + config.listings.expiryDays);
  return expiresAt;
};

const assertTransitionAllowed = (actorType, currentStatus, targetStatus) => {
  const allowedTargets = TRANSITION_MAP[actorType]?.[currentStatus] || [];
  if (!allowedTargets.includes(targetStatus)) {
    throw new AppError(
      `Invalid status transition: cannot move listing from ${currentStatus} to ${targetStatus}.`,
      409
    );
  }
};

const ensureCategoryExists = async (categoryId) => {
  if (!categoryId) return null;
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) {
    throw new AppError('Selected category does not exist.', 400);
  }
  return category;
};

const assertReadyToPublish = (product) => {
  const missing = [];
  if (!product.title || !String(product.title).trim()) missing.push('title');
  if (!product.description || !String(product.description).trim()) missing.push('description');
  if (product.price === null || product.price === undefined) missing.push('price');
  if (!product.categoryId) missing.push('categoryId');
  if (!product.condition) missing.push('condition');

  if (missing.length > 0) {
    throw new AppError(
      `Listing is missing required fields to publish: ${missing.join(', ')}.`,
      422
    );
  }
};

const findActiveProductOrThrow = async (productId) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    include: PRODUCT_INCLUDE,
  });
  if (!product) {
    throw new AppError('Product listing not found.', 404);
  }
  return product;
};

/**
 * Create a new product listing as DRAFT or immediately ACTIVE.
 */
const createProduct = async (sellerId, payload) => {
  const saveAsDraft = payload.saveAsDraft === true;
  const cleanTitle = sanitizePlainText(payload.title);
  if (!cleanTitle || cleanTitle.length > 120) {
    throw new AppError('Title must be between 1 and 120 characters.', 422);
  }

  const cleanDescription =
    payload.description !== undefined && payload.description !== null && payload.description !== ''
      ? sanitizePlainText(payload.description)
      : null;

  if (cleanDescription && cleanDescription.length > 2000) {
    throw new AppError('Description must be at most 2000 characters.', 422);
  }

  const decimalPrice = toDecimalPrice(payload.price);
  const categoryId = payload.categoryId || null;
  if (categoryId) {
    await ensureCategoryExists(categoryId);
  }

  const condition = payload.condition || null;
  const cleanTags = sanitizeTags(payload.tags);
  const isNegotiable = payload.isNegotiable !== undefined ? Boolean(payload.isNegotiable) : true;

  const data = {
    sellerId,
    title: cleanTitle,
    description: cleanDescription,
    price: decimalPrice,
    categoryId,
    condition,
    isNegotiable,
    tags: cleanTags,
    status: saveAsDraft ? 'DRAFT' : 'ACTIVE',
  };

  if (!saveAsDraft) {
    assertReadyToPublish(data);
    const now = new Date();
    data.publishedAt = now;
    data.expiresAt = getExpiresAt(now);
  }

  const created = await prisma.product.create({
    data,
    include: PRODUCT_INCLUDE,
  });

  return formatProduct(created);
};

/**
 * Owner-only edit allowed in DRAFT, ACTIVE, or RESERVED status.
 */
const updateProduct = async (productId, actorId, payload) => {
  const existing = await findActiveProductOrThrow(productId);

  if (existing.sellerId !== actorId) {
    throw new AppError('Forbidden: you can only edit your own listings.', 403);
  }

  if (!EDITABLE_STATUSES.includes(existing.status)) {
    throw new AppError(
      `Listing cannot be edited while in ${existing.status} status.`,
      409
    );
  }

  const updateData = {};

  if (payload.title !== undefined) {
    const cleanTitle = sanitizePlainText(payload.title);
    if (!cleanTitle || cleanTitle.length > 120) {
      throw new AppError('Title must be between 1 and 120 characters.', 422);
    }
    updateData.title = cleanTitle;
  }

  if (payload.description !== undefined) {
    const cleanDesc =
      payload.description === null || payload.description === ''
        ? null
        : sanitizePlainText(payload.description);
    if (cleanDesc && cleanDesc.length > 2000) {
      throw new AppError('Description must be at most 2000 characters.', 422);
    }
    updateData.description = cleanDesc;
  }

  if (payload.price !== undefined) {
    updateData.price = toDecimalPrice(payload.price);
  }

  if (payload.categoryId !== undefined) {
    if (payload.categoryId === null || payload.categoryId === '') {
      updateData.categoryId = null;
    } else {
      await ensureCategoryExists(payload.categoryId);
      updateData.categoryId = payload.categoryId;
    }
  }

  if (payload.condition !== undefined) {
    updateData.condition = payload.condition || null;
  }

  if (payload.isNegotiable !== undefined) {
    updateData.isNegotiable = Boolean(payload.isNegotiable);
  }

  if (payload.tags !== undefined) {
    updateData.tags = sanitizeTags(payload.tags);
  }

  // Published listings must keep required fields intact
  if (existing.status !== 'DRAFT') {
    assertReadyToPublish({
      ...existing,
      ...updateData,
    });
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: updateData,
    include: PRODUCT_INCLUDE,
  });

  return formatProduct(updated);
};

/**
 * Publishes a DRAFT listing (DRAFT -> ACTIVE).
 */
const publishProduct = async (productId, actorId) => {
  const existing = await findActiveProductOrThrow(productId);

  if (existing.sellerId !== actorId) {
    throw new AppError('Forbidden: you can only publish your own listings.', 403);
  }

  if (existing.status !== 'DRAFT') {
    throw new AppError(
      `Invalid status transition: only DRAFT listings can be published (current: ${existing.status}).`,
      409
    );
  }

  assertTransitionAllowed('seller', existing.status, 'ACTIVE');
  assertReadyToPublish(existing);

  const now = new Date();
  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      status: 'ACTIVE',
      publishedAt: now,
      expiresAt: getExpiresAt(now),
    },
    include: PRODUCT_INCLUDE,
  });

  return formatProduct(updated);
};

/**
 * Seller lifecycle transition: ACTIVE <-> RESERVED, ACTIVE/RESERVED -> SOLD, EXPIRED -> ACTIVE.
 */
const updateSellerStatus = async (productId, actorId, targetStatus) => {
  const existing = await findActiveProductOrThrow(productId);

  if (existing.sellerId !== actorId) {
    throw new AppError('Forbidden: you can only update the status of your own listings.', 403);
  }

  // DRAFT must go through /publish, not /status
  if (existing.status === 'DRAFT') {
    throw new AppError(
      'Invalid status transition: DRAFT listings must be published via /publish.',
      409
    );
  }

  assertTransitionAllowed('seller', existing.status, targetStatus);

  const now = new Date();
  const updateData = { status: targetStatus };

  if (targetStatus === 'SOLD') {
    updateData.soldAt = now;
  }

  // Relisting an EXPIRED listing resets expiresAt
  if (existing.status === 'EXPIRED' && targetStatus === 'ACTIVE') {
    assertReadyToPublish(existing);
    updateData.publishedAt = existing.publishedAt || now;
    updateData.expiresAt = getExpiresAt(now);
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: updateData,
    include: PRODUCT_INCLUDE,
  });

  return formatProduct(updated);
};

/**
 * Moderator / Admin transition: ACTIVE/RESERVED -> UNDER_REVIEW and UNDER_REVIEW -> ACTIVE.
 */
const updateModeratorStatus = async (productId, targetStatus) => {
  const existing = await findActiveProductOrThrow(productId);
  assertTransitionAllowed('moderator', existing.status, targetStatus);

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { status: targetStatus },
    include: PRODUCT_INCLUDE,
  });

  return formatProduct(updated);
};

/**
 * Hard delete DRAFT listings; soft delete (deletedAt) all other statuses.
 * Allowed for owner or ADMIN.
 */
const deleteProduct = async (productId, actor) => {
  const existing = await findActiveProductOrThrow(productId);

  const isOwner = existing.sellerId === actor.id;
  const isAdmin = actor.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    throw new AppError('Forbidden: you can only delete your own listings.', 403);
  }

  if (existing.status === 'DRAFT') {
    await prisma.product.delete({ where: { id: productId } });
    return { id: productId, deletionType: 'hard' };
  }

  await prisma.product.update({
    where: { id: productId },
    data: { deletedAt: new Date() },
  });

  return { id: productId, deletionType: 'soft' };
};

/**
 * Fetch product details with visibility enforcement and non-owner viewCount increment.
 */
const getProductById = async (productId, viewer = null) => {
  const existing = await findActiveProductOrThrow(productId);

  const isOwner = Boolean(viewer && viewer.id === existing.sellerId);
  const isPrivileged = Boolean(viewer && (viewer.role === 'ADMIN' || viewer.role === 'MODERATOR'));
  const isPublicStatus = PUBLIC_VISIBLE_STATUSES.includes(existing.status);

  if (!isPublicStatus && !isOwner && !isPrivileged) {
    throw new AppError('This listing is not publicly available.', 403);
  }

  if (!isOwner) {
    const incremented = await prisma.product.update({
      where: { id: productId },
      data: { viewCount: { increment: 1 } },
      include: PRODUCT_INCLUDE,
    });
    return formatProduct(incremented);
  }

  return formatProduct(existing);
};

/**
 * Public paginated marketplace feed (ACTIVE & RESERVED only, newest first).
 */
const listPublicProducts = async ({ page = 1, limit = 12, categoryId = null }) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 12));
  const skip = (safePage - 1) * safeLimit;

  const where = {
    deletedAt: null,
    status: { in: FEED_STATUSES },
    ...(categoryId ? { categoryId } : {}),
  };

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: PRODUCT_INCLUDE,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: products.map(formatProduct),
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

/**
 * Seller's own listings with optional ?status= filter.
 */
const listMyProducts = async (sellerId, { page = 1, limit = 20, status = null }) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  const skip = (safePage - 1) * safeLimit;

  const where = {
    sellerId,
    deletedAt: null,
    ...(status ? { status } : {}),
  };

  const [products, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: PRODUCT_INCLUDE,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products: products.map(formatProduct),
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

module.exports = {
  TRANSITION_MAP,
  EDITABLE_STATUSES,
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
