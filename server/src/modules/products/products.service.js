// server/src/modules/products/products.service.js
const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const config = require('../../config');
const { prisma } = require('../../config/db');
const cache = require('../../services/cache');
const AppError = require('../../utils/AppError');
const { sanitizePlainText } = require('../../utils/sanitize');
const { formatUserWithAvatar } = require('../../utils/userFormatter');
const { deleteVariants } = require('../../services/images');
const {
  formatProductImage,
  formatPrimaryImage,
} = require('../product-images/productImages.service');

const EDITABLE_STATUSES = ['DRAFT', 'ACTIVE', 'RESERVED'];
const PUBLIC_VISIBLE_STATUSES = ['ACTIVE', 'RESERVED', 'SOLD'];
const FEED_STATUSES = ['ACTIVE', 'RESERVED'];
const PRODUCTS_VERSION_KEY = 'products:version';

/**
 * Central Listing Lifecycle Transition Map
 * Single source of truth for all seller and moderator status transitions.
 */
const TRANSITION_MAP = {
  seller: {
    DRAFT: ['ACTIVE'], // via /publish
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
  avatarKey: true,
  isVerifiedStudent: true,
  ratingAverage: true,
};

const CATEGORY_SELECT = {
  id: true,
  name: true,
  slug: true,
};

const PRODUCT_DETAIL_INCLUDE = {
  seller: { select: SELLER_PUBLIC_SELECT },
  category: { select: CATEGORY_SELECT },
  images: {
    orderBy: { position: 'asc' },
    select: {
      id: true,
      storageKey: true,
      position: true,
      isPrimary: true,
      width: true,
      height: true,
      sizeBytes: true,
      blurDataUrl: true,
    },
  },
};

const PRODUCT_LIST_INCLUDE = {
  seller: { select: SELLER_PUBLIC_SELECT },
  category: { select: CATEGORY_SELECT },
  images: {
    where: { isPrimary: true },
    take: 1,
    select: {
      id: true,
      storageKey: true,
      blurDataUrl: true,
    },
  },
};

const invalidateProductCaches = async (productId = null) => {
  const ops = [
    cache.bumpVersion(PRODUCTS_VERSION_KEY),
    cache.delByPrefix('search:suggest:'),
  ];
  if (productId) {
    ops.push(cache.del(`products:detail:${productId}`));
  }
  await Promise.all(ops);
};

const formatProductDetail = async (product) => {
  if (!product) return null;
  const [seller, images] = await Promise.all([
    formatUserWithAvatar(product.seller),
    Promise.all((product.images || []).map(formatProductImage)),
  ]);

  return {
    ...product,
    price: product.price !== null && product.price !== undefined ? Number(product.price) : null,
    seller,
    images,
  };
};

const formatProductListItem = async (product) => {
  if (!product) return null;
  const { images, ...rest } = product;
  const [seller, primaryImage] = await Promise.all([
    formatUserWithAvatar(product.seller),
    formatPrimaryImage(images && images[0] ? images[0] : null),
  ]);

  return {
    ...rest,
    price: product.price !== null && product.price !== undefined ? Number(product.price) : null,
    seller,
    primaryImage,
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

const assertReadyToPublish = (product, { requireImages = true } = {}) => {
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

  if (requireImages) {
    const imageCount = Array.isArray(product.images) ? product.images.length : 0;
    if (imageCount < 1) {
      throw new AppError(
        'Listing must have at least 1 image before publishing.',
        422
      );
    }
  }
};

const findActiveProductOrThrow = async (productId) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    include: PRODUCT_DETAIL_INCLUDE,
  });
  if (!product) {
    throw new AppError('Product listing not found.', 404);
  }
  return product;
};

/**
 * Create a new product listing as DRAFT (0 images allowed) or ACTIVE.
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
    assertReadyToPublish({ ...data, images: [] }, { requireImages: true });
  }

  const created = await prisma.product.create({
    data,
    include: PRODUCT_DETAIL_INCLUDE,
  });

  await invalidateProductCaches(created.id);
  return formatProductDetail(created);
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

  if (existing.status !== 'DRAFT') {
    assertReadyToPublish(
      { ...existing, ...updateData },
      { requireImages: false }
    );
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: updateData,
    include: PRODUCT_DETAIL_INCLUDE,
  });

  await invalidateProductCaches(productId);
  return formatProductDetail(updated);
};

/**
 * Publishes a DRAFT listing (DRAFT -> ACTIVE). Requires at least 1 uploaded image.
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
  assertReadyToPublish(existing, { requireImages: true });

  const now = new Date();
  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      status: 'ACTIVE',
      publishedAt: now,
      expiresAt: getExpiresAt(now),
    },
    include: PRODUCT_DETAIL_INCLUDE,
  });

  await invalidateProductCaches(productId);
  return formatProductDetail(updated);
};

/**
 * Seller lifecycle transition: ACTIVE <-> RESERVED, ACTIVE/RESERVED -> SOLD, EXPIRED -> ACTIVE.
 */
const updateSellerStatus = async (productId, actorId, targetStatus) => {
  const existing = await findActiveProductOrThrow(productId);

  if (existing.sellerId !== actorId) {
    throw new AppError('Forbidden: you can only update the status of your own listings.', 403);
  }

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

  if (existing.status === 'EXPIRED' && targetStatus === 'ACTIVE') {
    assertReadyToPublish(existing, { requireImages: true });
    updateData.publishedAt = existing.publishedAt || now;
    updateData.expiresAt = getExpiresAt(now);
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: updateData,
    include: PRODUCT_DETAIL_INCLUDE,
  });

  await invalidateProductCaches(productId);
  return formatProductDetail(updated);
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
    include: PRODUCT_DETAIL_INCLUDE,
  });

  await invalidateProductCaches(productId);
  return formatProductDetail(updated);
};

/**
 * Hard delete DRAFT listings (and delete storage objects); soft delete (deletedAt) all other statuses.
 */
const deleteProduct = async (productId, actor) => {
  const existing = await findActiveProductOrThrow(productId);

  const isOwner = existing.sellerId === actor.id;
  const isAdmin = actor.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    throw new AppError('Forbidden: you can only delete your own listings.', 403);
  }

  if (existing.status === 'DRAFT') {
    const keysToDelete = (existing.images || []).map((img) => img.storageKey);
    await prisma.product.delete({ where: { id: productId } });
    await Promise.all(keysToDelete.map((key) => deleteVariants(key)));
    await invalidateProductCaches(productId);
    return { id: productId, deletionType: 'hard' };
  }

  await prisma.product.update({
    where: { id: productId },
    data: { deletedAt: new Date() },
  });

  await invalidateProductCaches(productId);
  return { id: productId, deletionType: 'soft' };
};

/**
 * Fetch product details:
 * - Private statuses (DRAFT, EXPIRED, UNDER_REVIEW, SOLD) and owner/moderator views NEVER read or write cache.
 * - Non-owner viewCount increment is NEVER cached and always writes directly to PostgreSQL.
 * - Public non-owner reads reuse 30s cached payload for heavy joins/signing and apply fresh DB viewCount.
 */
const getProductById = async (productId, viewer = null) => {
  const detailCacheKey = `products:detail:${productId}`;
  const isPrivilegedViewer = Boolean(
    viewer && (viewer.role === 'ADMIN' || viewer.role === 'MODERATOR')
  );

  // Only inspect cache when the caller is anonymous or a regular student
  if (!isPrivilegedViewer) {
    const cached = await cache.get(detailCacheKey);
    if (
      cached &&
      FEED_STATUSES.includes(cached.status) &&
      (!viewer || viewer.id !== cached.sellerId)
    ) {
      const inc = await prisma.product.updateMany({
        where: { id: productId, deletedAt: null, status: { in: FEED_STATUSES } },
        data: { viewCount: { increment: 1 } },
      });
      if (inc.count > 0) {
        const freshRow = await prisma.product.findUnique({
          where: { id: productId },
          select: { viewCount: true },
        });
        return {
          ...cached,
          viewCount: freshRow ? freshRow.viewCount : cached.viewCount + 1,
        };
      }
      // Underlying status changed outside expected state; invalidate stale key and fall through
      await cache.del(detailCacheKey);
    }
  }

  const existing = await findActiveProductOrThrow(productId);

  const isOwner = Boolean(viewer && viewer.id === existing.sellerId);
  const isPublicVisible = PUBLIC_VISIBLE_STATUSES.includes(existing.status);
  const isFeedPublic = FEED_STATUSES.includes(existing.status);

  if (!isPublicVisible && !isOwner && !isPrivilegedViewer) {
    throw new AppError('This listing is not publicly available.', 403);
  }

  let record = existing;
  if (!isOwner) {
    record = await prisma.product.update({
      where: { id: productId },
      data: { viewCount: { increment: 1 } },
      include: PRODUCT_DETAIL_INCLUDE,
    });
  }

  const formatted = await formatProductDetail(record);

  // Never cache non-public listings or owner/moderator views
  if (isFeedPublic && !isOwner && !isPrivilegedViewer) {
    await cache.set(detailCacheKey, formatted, config.cache.productDetailTtlSeconds);
  }

  return formatted;
};

/**
 * Normalizes query parameters for product search/filtering/sorting.
 */
const normalizeProductQuery = (raw = {}) => {
  const q = raw.q !== undefined && raw.q !== null ? String(raw.q).trim().slice(0, 100) : '';
  const page = Math.max(1, Number(raw.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(raw.limit) || 12));
  const categoryId = raw.categoryId ? String(raw.categoryId).trim() : null;
  const category = raw.category ? String(raw.category).trim().toLowerCase() : null;
  const minPrice =
    raw.minPrice !== undefined && raw.minPrice !== '' && raw.minPrice !== null
      ? Number(raw.minPrice)
      : null;
  const maxPrice =
    raw.maxPrice !== undefined && raw.maxPrice !== '' && raw.maxPrice !== null
      ? Number(raw.maxPrice)
      : null;

  const conditions = raw.condition
    ? Array.from(
        new Set(
          String(raw.condition)
            .split(',')
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean)
        )
      ).sort()
    : [];

  const availability = ['available', 'reserved', 'all'].includes(raw.availability)
    ? raw.availability
    : 'all';

  let isNegotiable = null;
  if (raw.isNegotiable === true || raw.isNegotiable === 'true') isNegotiable = true;
  if (raw.isNegotiable === false || raw.isNegotiable === 'false') isNegotiable = false;

  const verifiedSeller = raw.verifiedSeller === true || raw.verifiedSeller === 'true';

  const defaultSort = q ? 'relevance' : 'newest';
  const sort = raw.sort && ['newest', 'price_asc', 'price_desc', 'popularity', 'relevance'].includes(raw.sort)
    ? raw.sort
    : defaultSort;

  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw new AppError('minPrice cannot be greater than maxPrice.', 422);
  }
  if (sort === 'relevance' && !q) {
    throw new AppError('sort=relevance is only valid when search query q is provided.', 422);
  }

  return {
    q,
    page,
    limit,
    categoryId,
    category,
    minPrice,
    maxPrice,
    conditions,
    availability,
    isNegotiable,
    verifiedSeller,
    sort,
  };
};

const getAllowedStatusesForAvailability = (availability) => {
  if (availability === 'available') return ['ACTIVE'];
  if (availability === 'reserved') return ['RESERVED'];
  return FEED_STATUSES;
};

const getPrismaOrderBy = (sort) => {
  switch (sort) {
    case 'price_asc':
      return [{ price: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }];
    case 'price_desc':
      return [{ price: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }];
    case 'popularity':
      return [{ viewCount: 'desc' }, { publishedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }];
    case 'newest':
    default:
      return [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { id: 'desc' }];
  }
};

const getSqlOrderBy = (sort) => {
  switch (sort) {
    case 'price_asc':
      return Prisma.sql`ORDER BY p."price" ASC NULLS LAST, p."id" ASC`;
    case 'price_desc':
      return Prisma.sql`ORDER BY p."price" DESC NULLS LAST, p."id" DESC`;
    case 'popularity':
      return Prisma.sql`ORDER BY p."viewCount" DESC, p."publishedAt" DESC NULLS LAST, p."id" DESC`;
    case 'newest':
      return Prisma.sql`ORDER BY p."publishedAt" DESC NULLS LAST, p."createdAt" DESC, p."id" DESC`;
    case 'relevance':
    default:
      return Prisma.sql`ORDER BY match_score DESC, p."publishedAt" DESC NULLS LAST, p."id" DESC`;
  }
};

const buildSqlFilterClause = (params) => {
  const statuses = getAllowedStatusesForAvailability(params.availability);
  const clauses = [
    Prisma.sql`p."deletedAt" IS NULL`,
    Prisma.sql`p."status" IN (${Prisma.join(statuses.map((s) => Prisma.sql`${s}::"ListingStatus"`))})`,
  ];

  if (params.categoryId) {
    clauses.push(Prisma.sql`p."categoryId" = ${params.categoryId}`);
  } else if (params.category) {
    clauses.push(Prisma.sql`c."slug" = ${params.category}`);
  }

  if (params.minPrice !== null) {
    clauses.push(Prisma.sql`p."price" >= ${params.minPrice}`);
  }

  if (params.maxPrice !== null) {
    clauses.push(Prisma.sql`p."price" <= ${params.maxPrice}`);
  }

  if (params.conditions.length > 0) {
    clauses.push(
      Prisma.sql`p."condition" IN (${Prisma.join(params.conditions.map((c) => Prisma.sql`${c}::"Condition"`))})`
    );
  }

  if (params.isNegotiable !== null) {
    clauses.push(Prisma.sql`p."isNegotiable" = ${params.isNegotiable}`);
  }

  if (params.verifiedSeller) {
    clauses.push(Prisma.sql`u."isVerifiedStudent" = true`);
  }

  return Prisma.join(clauses, ' AND ');
};

const runKeywordSearch = async (params) => {
  const filterSql = buildSqlFilterClause(params);
  const orderSql = getSqlOrderBy(params.sort);
  const skip = (params.page - 1) * params.limit;
  const q = params.q;

  // Step 1: Primary GIN full-text search (websearch_to_tsquery + ts_rank on weighted A/B/C vector)
  const ftCountRows = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS total
    FROM "products" p
    LEFT JOIN "categories" c ON c."id" = p."categoryId"
    INNER JOIN "users" u ON u."id" = p."sellerId"
    WHERE ${filterSql}
      AND p."searchVector" @@ websearch_to_tsquery('english', ${q})
  `;
  const ftTotal = ftCountRows[0]?.total || 0;

  let total = ftTotal;
  let idRows;

  if (ftTotal >= 3) {
    idRows = await prisma.$queryRaw`
      SELECT
        p."id",
        (
          ts_rank(p."searchVector", websearch_to_tsquery('english', ${q})) * 10
          + CASE WHEN LOWER(p."title") LIKE ${`${q.toLowerCase()}%`} THEN 5 ELSE 0 END
        )::float8 AS match_score
      FROM "products" p
      LEFT JOIN "categories" c ON c."id" = p."categoryId"
      INNER JOIN "users" u ON u."id" = p."sellerId"
      WHERE ${filterSql}
        AND p."searchVector" @@ websearch_to_tsquery('english', ${q})
      ${orderSql}
      LIMIT ${params.limit}
      OFFSET ${skip}
    `;
  } else {
    // Step 2: Hybrid full-text + GIN trigram similarity fallback for typos/prefixes
    const hybridResult = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL pg_trgm.word_similarity_threshold = 0.35`;
      await tx.$executeRaw`SET LOCAL pg_trgm.similarity_threshold = 0.25`;

      const totalRows = await tx.$queryRaw`
        SELECT COUNT(*)::int AS total
        FROM "products" p
        LEFT JOIN "categories" c ON c."id" = p."categoryId"
        INNER JOIN "users" u ON u."id" = p."sellerId"
        WHERE ${filterSql}
          AND (
            p."searchVector" @@ websearch_to_tsquery('english', ${q})
            OR ${q} <% p."title"
            OR p."title" % ${q}
            OR p."title" ILIKE ${`%${q}%`}
          )
      `;

      const pageIdRows = await tx.$queryRaw`
        SELECT
          p."id",
          (
            CASE
              WHEN p."searchVector" @@ websearch_to_tsquery('english', ${q})
                THEN ts_rank(p."searchVector", websearch_to_tsquery('english', ${q})) * 10 + 1
              ELSE 0
            END
            + GREATEST(word_similarity(${q}, p."title"), similarity(p."title", ${q}))
            + CASE WHEN LOWER(p."title") LIKE ${`${q.toLowerCase()}%`} THEN 3 ELSE 0 END
          )::float8 AS match_score
        FROM "products" p
        LEFT JOIN "categories" c ON c."id" = p."categoryId"
        INNER JOIN "users" u ON u."id" = p."sellerId"
        WHERE ${filterSql}
          AND (
            p."searchVector" @@ websearch_to_tsquery('english', ${q})
            OR ${q} <% p."title"
            OR p."title" % ${q}
            OR p."title" ILIKE ${`%${q}%`}
          )
        ${orderSql}
        LIMIT ${params.limit}
        OFFSET ${skip}
      `;

      return { total: totalRows[0]?.total || 0, pageIdRows };
    });

    total = hybridResult.total;
    idRows = hybridResult.pageIdRows;
  }

  if (!idRows || idRows.length === 0) {
    return { products: [], total };
  }

  const orderedIds = idRows.map((r) => r.id);
  const fetched = await prisma.product.findMany({
    where: { id: { in: orderedIds } },
    include: PRODUCT_LIST_INCLUDE,
  });

  const byId = new Map(fetched.map((p) => [p.id, p]));
  const orderedProducts = orderedIds.map((id) => byId.get(id)).filter(Boolean);

  return {
    products: await Promise.all(orderedProducts.map(formatProductListItem)),
    total,
  };
};

const shouldRecordPopularTerm = (term) => {
  if (!term || term.length < 2 || term.length > 50) return false;
  if (!/[a-z0-9]/i.test(term)) return false;
  // Exclude email-like or long digit sequences (PII protection)
  if (term.includes('@') || /\d{9,}/.test(term)) return false;
  return true;
};

const recordExecutedSearch = async (rawTerm, totalResults, clientIp = 'unknown') => {
  if (!totalResults || totalResults < 1) return;
  const normalized = String(rawTerm || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!shouldRecordPopularTerm(normalized)) return;

  const ipHash = crypto.createHash('sha256').update(String(clientIp || 'unknown')).digest('hex').slice(0, 16);
  const termHash = crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  const allowed = await cache.setIfAbsent(`search:ip:${ipHash}:${termHash}`, '1', 60);
  if (!allowed) return;

  await cache.zIncrBy('search:popular', normalized, 1, 200);
};

/**
 * Public search, filter, sort & paginated marketplace feed (ACTIVE & RESERVED only).
 * Cached by version + normalized params hash (TTL 60s).
 */
const listPublicProducts = async (rawQuery = {}) => {
  const { clientIp = 'unknown', onCacheStatus = null, ...rest } = rawQuery;
  const params = normalizeProductQuery(rest);
  const skip = (params.page - 1) * params.limit;

  const version = await cache.getVersion(PRODUCTS_VERSION_KEY);
  const paramHash = crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex');
  const cacheKey = `products:list:v${version}:${paramHash}`;

  const payload = await cache.getOrSet(
    cacheKey,
    Math.min(config.cache.defaultTtlSeconds, 60),
    async () => {
      let formattedProducts;
      let total;

      if (params.q) {
        const searchResult = await runKeywordSearch(params);
        formattedProducts = searchResult.products;
        total = searchResult.total;
      } else {
        const statuses = getAllowedStatusesForAvailability(params.availability);
        const where = {
          deletedAt: null,
          status: { in: statuses },
          ...(params.categoryId ? { categoryId: params.categoryId } : {}),
          ...(!params.categoryId && params.category
            ? { category: { slug: params.category } }
            : {}),
          ...(params.minPrice !== null || params.maxPrice !== null
            ? {
                price: {
                  ...(params.minPrice !== null ? { gte: params.minPrice } : {}),
                  ...(params.maxPrice !== null ? { lte: params.maxPrice } : {}),
                },
              }
            : {}),
          ...(params.conditions.length > 0 ? { condition: { in: params.conditions } } : {}),
          ...(params.isNegotiable !== null ? { isNegotiable: params.isNegotiable } : {}),
          ...(params.verifiedSeller ? { seller: { isVerifiedStudent: true } } : {}),
        };

        const [products, count] = await prisma.$transaction([
          prisma.product.findMany({
            where,
            skip,
            take: params.limit,
            orderBy: getPrismaOrderBy(params.sort),
            include: PRODUCT_LIST_INCLUDE,
          }),
          prisma.product.count({ where }),
        ]);

        formattedProducts = await Promise.all(products.map(formatProductListItem));
        total = count;
      }

      const totalPages = Math.ceil(total / params.limit) || 1;

      return {
        products: formattedProducts,
        pagination: {
          total,
          page: params.page,
          limit: params.limit,
          totalPages,
          hasNext: params.page < totalPages,
        },
      };
    },
    { onStatus: onCacheStatus }
  );

  if (params.q) {
    await recordExecutedSearch(params.q, payload?.pagination?.total || 0, clientIp);
  }

  return payload;
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
      include: PRODUCT_LIST_INCLUDE,
    }),
    prisma.product.count({ where }),
  ]);

  const totalPages = Math.ceil(total / safeLimit) || 1;

  return {
    products: await Promise.all(products.map(formatProductListItem)),
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
      hasNext: safePage < totalPages,
    },
  };
};

module.exports = {
  TRANSITION_MAP,
  EDITABLE_STATUSES,
  PRODUCTS_VERSION_KEY,
  invalidateProductCaches,
  createProduct,
  updateProduct,
  publishProduct,
  updateSellerStatus,
  updateModeratorStatus,
  deleteProduct,
  getProductById,
  listPublicProducts,
  listMyProducts,
  normalizeProductQuery,
};
