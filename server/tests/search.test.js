// server/tests/search.test.js
const crypto = require('crypto');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const express = require('express');

jest.mock('../src/services/storage', () => ({
  putObject: jest.fn(async ({ key }) => ({ key })),
  deleteObject: jest.fn(async () => {}),
  deleteObjects: jest.fn(async () => {}),
  listObjects: jest.fn(async () => []),
  getSignedReadUrl: jest.fn(async (key, expiresInSeconds = 900) =>
    key
      ? `https://storage.campusx.test/campusx-media/${key}?X-Amz-Expires=${expiresInSeconds}&X-Amz-Signature=mock`
      : null
  ),
  getPublicUrl: jest.fn((key) => (key ? `https://cdn.campusx.test/${key}` : null)),
  ensureStorageReady: jest.fn(async () => true),
}));

const app = require('../src/app');
const { prisma } = require('../src/config/db');
const cache = require('../src/services/cache');
const { seedCategories } = require('../prisma/seed');
const { createRateLimiter } = require('../src/middleware/security');

const TEST_DOMAIN = '@searchtest.campusx.local';
const STRONG_PASSWORD = 'Password123!';

jest.setTimeout(30000);

describe('Day 6: Search Engine, Filters, Sorting, Autocomplete & Redis Caching Suite', () => {
  const createdEmails = [];
  let categories = [];
  let verifiedSeller;
  let unverifiedUser;
  let adminUser;
  let moderatorUser;
  let uniquePrefix;

  const trackEmail = (email) => {
    createdEmails.push(email.toLowerCase());
    return email.toLowerCase();
  };

  const createUser = async ({ prefix, role = 'STUDENT', verified = true }) => {
    const email = trackEmail(
      `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${TEST_DOMAIN}`
    );
    const passwordHash = await bcrypt.hash(STRONG_PASSWORD, 12);
    const user = await prisma.user.create({
      data: {
        name: `Search ${prefix}`,
        email,
        passwordHash,
        role,
        isActive: true,
        isVerifiedStudent: verified,
        ...(verified
          ? {
              collegeEmail: `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@chitkara.edu.in`,
              verifiedAt: new Date(),
            }
          : {}),
      },
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email,
      password: STRONG_PASSWORD,
    });

    return { user, token: loginRes.body.data.accessToken, email };
  };

  const createSeededListing = async ({
    sellerId,
    categoryId,
    title,
    description,
    price,
    condition = 'GOOD',
    status = 'ACTIVE',
    isNegotiable = true,
    viewCount = 0,
    tags = [],
    deletedAt = null,
    publishedAt = new Date(),
  }) => {
    const product = await prisma.product.create({
      data: {
        sellerId,
        categoryId,
        title,
        description,
        price,
        condition,
        status,
        isNegotiable,
        viewCount,
        tags,
        deletedAt,
        publishedAt,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const imgId = crypto.randomUUID();
    await prisma.productImage.create({
      data: {
        id: imgId,
        productId: product.id,
        storageKey: `products/${product.id}/${imgId}`,
        position: 0,
        isPrimary: true,
        width: 800,
        height: 600,
        sizeBytes: 10000,
        blurDataUrl: 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=',
      },
    });

    await cache.bumpVersion('products:version');
    return product;
  };

  beforeAll(async () => {
    uniquePrefix = `alpha${Date.now().toString(36)}`;
    await cache.getHealthStatus();
    await seedCategories(prisma);
    categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });

    verifiedSeller = await createUser({ prefix: `${uniquePrefix}_ver`, verified: true });
    unverifiedUser = await createUser({ prefix: `${uniquePrefix}_unv`, verified: false });
    adminUser = await createUser({ prefix: `${uniquePrefix}_adm`, role: 'ADMIN', verified: true });
    moderatorUser = await createUser({ prefix: `${uniquePrefix}_mod`, role: 'MODERATOR', verified: true });

    // Ensure clean Redis cache state for search test prefix
    await cache.delByPrefix('search:');
    await cache.delByPrefix('products:');
    await cache.delByPrefix('categories:');
  });

  afterAll(async () => {
    await cache.delByPrefix('search:');
    await cache.delByPrefix('products:');
    await cache.delByPrefix('auth:');
    await cache.delByPrefix('rl:twoinst:');

    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
    await cache.disconnect();
    await prisma.$disconnect();
  });

  it('ranks title matches above description matches, handles typos via pg_trgm, and blocks non-public statuses', async () => {
    const booksCat = categories.find((c) => c.slug === 'books');
    const cyclesCat = categories.find((c) => c.slug === 'cycles');

    const tokenKey = `quantumphotonix${Date.now().toString(36)}`;

    const descOnly = await createSeededListing({
      sellerId: verifiedSeller.user.id,
      categoryId: booksCat.id,
      title: `Study Guide Notes ${uniquePrefix}`,
      description: `Covers ${tokenKey} mechanics and thermodynamics.`,
      price: 300,
      condition: 'GOOD',
      status: 'ACTIVE',
    });

    const titleMatch = await createSeededListing({
      sellerId: verifiedSeller.user.id,
      categoryId: booksCat.id,
      title: `${tokenKey} Physics Book ${uniquePrefix}`,
      description: 'Clean paperback copy.',
      price: 550,
      condition: 'LIKE_NEW',
      status: 'ACTIVE',
    });

    const bikeTitle = `Campus Bicycle ${Date.now().toString(36)}`;
    const bike = await createSeededListing({
      sellerId: verifiedSeller.user.id,
      categoryId: cyclesCat.id,
      title: bikeTitle,
      description: '21-speed geared cycle.',
      price: 4500,
      condition: 'GOOD',
      status: 'ACTIVE',
    });

    // Private / non-public listings must NEVER appear in search
    const draftHidden = await createSeededListing({
      sellerId: verifiedSeller.user.id,
      categoryId: booksCat.id,
      title: `${tokenKey} Draft Secret`,
      description: 'Hidden draft',
      price: 100,
      status: 'DRAFT',
    });
    const reviewHidden = await createSeededListing({
      sellerId: verifiedSeller.user.id,
      categoryId: booksCat.id,
      title: `${tokenKey} Under Review Secret`,
      description: 'Hidden review',
      price: 100,
      status: 'UNDER_REVIEW',
    });
    const soldHidden = await createSeededListing({
      sellerId: verifiedSeller.user.id,
      categoryId: booksCat.id,
      title: `${tokenKey} Already Sold`,
      description: 'Hidden sold',
      price: 100,
      status: 'SOLD',
    });
    const deletedHidden = await createSeededListing({
      sellerId: verifiedSeller.user.id,
      categoryId: booksCat.id,
      title: `${tokenKey} Soft Deleted`,
      description: 'Hidden deleted',
      price: 100,
      status: 'ACTIVE',
      deletedAt: new Date(),
    });

    // 1. Keyword ranking: title match beats description match
    const rankRes = await request(app).get(`/api/products?q=${tokenKey}`);
    expect(rankRes.statusCode).toBe(200);
    const ids = rankRes.body.data.products.map((p) => p.id);
    expect(ids).toEqual([titleMatch.id, descOnly.id]);
    expect(ids).not.toContain(draftHidden.id);
    expect(ids).not.toContain(reviewHidden.id);
    expect(ids).not.toContain(soldHidden.id);
    expect(ids).not.toContain(deletedHidden.id);

    // 2. Typo tolerance: "bycycle" finds "Campus Bicycle"
    const typoRes = await request(app).get('/api/products?q=bycycle');
    expect(typoRes.statusCode).toBe(200);
    expect(typoRes.body.data.products.some((p) => p.id === bike.id)).toBe(true);

    // 3. SQL injection attempts in q & unknown params are harmless
    const sqliRes = await request(app).get(
      `/api/products?q=${encodeURIComponent("'; DROP TABLE products; --")}&evilParam=123`
    );
    expect(sqliRes.statusCode).toBe(200);
    expect(Array.isArray(sqliRes.body.data.products)).toBe(true);
  });

  it('supports single & combined filters, validates minPrice <= maxPrice, sort=relevance rule, and stable pagination tie-breaking', async () => {
    const electronicsCat = categories.find((c) => c.slug === 'electronics');
    const sportsCat = categories.find((c) => c.slug === 'sports');

    // Create 4 listings with IDENTICAL price (777) to verify deterministic pagination across pages
    const tieTag = `tie_${Date.now()}`;
    const tieListings = [];
    for (let i = 0; i < 4; i += 1) {
      tieListings.push(
        await createSeededListing({
          sellerId: verifiedSeller.user.id,
          categoryId: electronicsCat.id,
          title: `Lamp ${tieTag} #${i}`,
          description: `Tie break test ${tieTag}`,
          price: 777,
          condition: i < 2 ? 'NEW' : 'FAIR',
          status: i === 3 ? 'RESERVED' : 'ACTIVE',
          isNegotiable: i % 2 === 0,
          viewCount: (4 - i) * 20,
        })
      );
    }

    // Create 1 listing by unverified user for verifiedSeller filter
    const unvItem = await createSeededListing({
      sellerId: unverifiedUser.user.id,
      categoryId: sportsCat.id,
      title: `Ball ${tieTag}`,
      description: `Unverified seller ${tieTag}`,
      price: 250,
      condition: 'USED',
      status: 'ACTIVE',
      isNegotiable: false,
      viewCount: 5,
    });

    // Invalid min > max -> 422
    const badRange = await request(app).get('/api/products?minPrice=500&maxPrice=100');
    expect(badRange.statusCode).toBe(422);

    // Invalid sort=relevance without q -> 422
    const badRel = await request(app).get('/api/products?sort=relevance');
    expect(badRel.statusCode).toBe(422);

    // Filter by category slug + price range + comma-separated condition + availability + isNegotiable + verifiedSeller
    const comboRes = await request(app).get(
      `/api/products?category=${electronicsCat.slug}&minPrice=700&maxPrice=800&condition=NEW,FAIR&availability=available&isNegotiable=true&verifiedSeller=true&q=${tieTag}`
    );
    expect(comboRes.statusCode).toBe(200);
    expect(comboRes.body.data.products.map((p) => p.id).sort()).toEqual(
      [tieListings[0].id, tieListings[2].id].sort()
    );

    // Availability = reserved only
    const resOnly = await request(app).get(`/api/products?q=${tieTag}&availability=reserved`);
    expect(resOnly.statusCode).toBe(200);
    expect(resOnly.body.data.products.map((p) => p.id)).toEqual([tieListings[3].id]);

    // Unverified excluded when verifiedSeller=true
    const verOnly = await request(app).get(`/api/products?q=${tieTag}&verifiedSeller=true`);
    expect(verOnly.body.data.products.some((p) => p.id === unvItem.id)).toBe(false);

    // Sort popularity
    const popRes = await request(app).get(`/api/products?q=${tieTag}&sort=popularity`);
    expect(popRes.statusCode).toBe(200);
    const viewCounts = popRes.body.data.products.map((p) => p.viewCount);
    expect(viewCounts).toEqual([...viewCounts].sort((a, b) => b - a));

    // Stable tie-breaker pagination on identical prices (page=1 & page=2, limit=2) -> zero overlap, zero gaps
    const p1 = await request(app).get(
      `/api/products?categoryId=${electronicsCat.id}&minPrice=777&maxPrice=777&sort=price_asc&page=1&limit=2`
    );
    const p2 = await request(app).get(
      `/api/products?categoryId=${electronicsCat.id}&minPrice=777&maxPrice=777&sort=price_asc&page=2&limit=2`
    );
    expect(p1.statusCode).toBe(200);
    expect(p1.body.data.pagination).toMatchObject({
      page: 1,
      limit: 2,
      total: 4,
      totalPages: 2,
      hasNext: true,
    });
    expect(p2.body.data.pagination.hasNext).toBe(false);

    const p1Ids = p1.body.data.products.map((p) => p.id);
    const p2Ids = p2.body.data.products.map((p) => p.id);
    expect(p1Ids.length).toBe(2);
    expect(p2Ids.length).toBe(2);
    const combinedSet = new Set([...p1Ids, ...p2Ids]);
    expect(combinedSet.size).toBe(4);
  });

  it('handles autocomplete suggest rules and popular searches counting & abuse guards', async () => {
    const booksCat = categories.find((c) => c.slug === 'books');
    const popTerm = `acousticswave${Date.now().toString(36)}`;
    await createSeededListing({
      sellerId: verifiedSeller.user.id,
      categoryId: booksCat.id,
      title: `Acoustics Textbook ${popTerm}`,
      description: 'Clean engineering acoustics book',
      price: 400,
    });

    // Suggest requires min 2 chars
    const shortRes = await request(app).get('/api/search/suggest?q=a');
    expect(shortRes.statusCode).toBe(422);

    // Suggest returns max 8 items combining categories & listings
    const sugRes = await request(app).get('/api/search/suggest?q=books');
    expect(sugRes.statusCode).toBe(200);
    expect(sugRes.body.data.suggestions.length).toBeLessThanOrEqual(8);
    expect(sugRes.body.data.suggestions.some((s) => s.type === 'category')).toBe(true);

    // Executing search with 0 results does NOT count in search:popular
    const gibberish = `zxqvbnm_${Date.now()}`;
    await request(app).get(`/api/products?q=${gibberish}`);

    // PII-looking search does NOT count
    await request(app).get('/api/products?q=student@chitkara.edu.in');

    // Valid search with >0 results DOES count once per IP/term window
    await request(app).get(`/api/products?q=${popTerm}`);
    await request(app).get(`/api/products?q=${popTerm}`); // same IP within 60s -> ignored

    const zMembers = await cache.zRevRangeWithScores('search:popular', 0, 20);
    const recorded = zMembers.find((m) => m.term === popTerm);
    expect(recorded).toBeDefined();
    expect(recorded.count).toBe(1);
    expect(zMembers.some((m) => m.term === gibberish)).toBe(false);
    expect(zMembers.some((m) => m.term.includes('@'))).toBe(false);

    // Clear popular top10 cache key and query public endpoint
    await cache.del('search:popular:top10');
    const popRes = await request(app).get('/api/search/popular');
    expect(popRes.statusCode).toBe(200);
    expect(popRes.body.data.popular.some((p) => p.term === popTerm)).toBe(true);
  });

  it('caches hits vs misses, invalidates on mutations, bypasses cache for private views, and fails open when Redis is down', async () => {
    const cyclesCat = categories.find((c) => c.slug === 'cycles');
    const item = await createSeededListing({
      sellerId: verifiedSeller.user.id,
      categoryId: cyclesCat.id,
      title: `CacheTestCycle_${Date.now()}`,
      description: 'Initial cached description',
      price: 2200,
    });

    const queryPath = `/api/products?q=${encodeURIComponent(item.title)}`;

    // 1st identical request -> MISS, 2nd identical -> HIT (if Redis connected)
    const r1 = await request(app).get(queryPath);
    const r2 = await request(app).get(queryPath);
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    if (cache.isReady()) {
      expect(r1.headers['x-cache']).toBe('MISS');
      expect(r2.headers['x-cache']).toBe('HIT');
    }

    // Mutate item (edit title/price) -> bumps products:version -> no stale price served!
    await request(app)
      .patch(`/api/products/${item.id}`)
      .set('Authorization', `Bearer ${verifiedSeller.token}`)
      .send({ price: 1999 });

    const r3 = await request(app).get(queryPath);
    expect(r3.statusCode).toBe(200);
    expect(r3.body.data.products[0].price).toBe(1999);
    if (cache.isReady()) {
      expect(r3.headers['x-cache']).toBe('MISS');
    }

    // Detail caching (30s) still increments viewCount for non-owners on every call
    const detail1 = await request(app).get(`/api/products/${item.id}`);
    const detail2 = await request(app).get(`/api/products/${item.id}`);
    expect(detail1.body.data.product.viewCount).toBe(1);
    expect(detail2.body.data.product.viewCount).toBe(2);

    // Moderator marks UNDER_REVIEW -> invalidates detail cache & private views bypass cache
    await request(app)
      .patch(`/api/admin/products/${item.id}/status`)
      .set('Authorization', `Bearer ${moderatorUser.token}`)
      .send({ status: 'UNDER_REVIEW' });

    const blockedPublic = await request(app).get(`/api/products/${item.id}`);
    expect(blockedPublic.statusCode).toBe(403);

    const modView = await request(app)
      .get(`/api/products/${item.id}`)
      .set('Authorization', `Bearer ${moderatorUser.token}`);
    expect(modView.statusCode).toBe(200);
    expect(modView.body.data.product.status).toBe('UNDER_REVIEW');

    const cachedAfterMod = await cache.get(`products:detail:${item.id}`);
    expect(cachedAfterMod).toBeNull();

    // Redis down (fail open): API still serves live DB results + /api/health reports redis disconnected
    cache.setForceDisabled(true);
    try {
      const failOpenList = await request(app).get('/api/products?limit=5');
      expect(failOpenList.statusCode).toBe(200);
      expect(failOpenList.body.success).toBe(true);

      const failOpenHealth = await request(app).get('/api/health');
      expect(failOpenHealth.statusCode).toBe(200);
      expect(failOpenHealth.body.data.redis.status).toBe('disconnected');
    } finally {
      cache.setForceDisabled(false);
    }
  });

  it('shares rate limits across two app instances via Redis and immediately invalidates auth cache on deactivation/role change', async () => {
    // 1. Two independent Express apps/limiters sharing same Redis store prefix
    const limiterApp1 = express();
    limiterApp1.use(
      createRateLimiter({
        windowMs: 60 * 1000,
        max: 3,
        prefix: 'twoinst',
        message: 'Shared rate limit hit',
        skipInTest: false,
      })
    );
    limiterApp1.get('/ping', (req, res) => res.json({ ok: true }));

    const limiterApp2 = express();
    limiterApp2.use(
      createRateLimiter({
        windowMs: 60 * 1000,
        max: 3,
        prefix: 'twoinst',
        message: 'Shared rate limit hit',
        skipInTest: false,
      })
    );
    limiterApp2.get('/ping', (req, res) => res.json({ ok: true }));

    expect((await request(limiterApp1).get('/ping')).statusCode).toBe(200);
    expect((await request(limiterApp2).get('/ping')).statusCode).toBe(200);
    expect((await request(limiterApp1).get('/ping')).statusCode).toBe(200);
    const fourth = await request(limiterApp2).get('/ping');
    expect(fourth.statusCode).toBe(429);

    // 2. Auth cache immediate invalidation on deactivation & role change
    const victim = await createUser({ prefix: `${uniquePrefix}_victim`, verified: true });

    // First call warms auth:user:{id} cache
    const meOk = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${victim.token}`);
    expect(meOk.statusCode).toBe(200);

    // Admin updates role to MODERATOR -> immediate effect
    const roleRes = await request(app)
      .patch(`/api/admin/users/${victim.user.id}/role`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({ role: 'MODERATOR' });
    expect(roleRes.statusCode).toBe(200);

    const adminListCheck = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${victim.token}`);
    expect(adminListCheck.statusCode).toBe(200);

    // Admin deactivates victim -> next request with SAME valid JWT blocked immediately (403)
    const deactivateRes = await request(app)
      .patch(`/api/admin/users/${victim.user.id}/status`)
      .set('Authorization', `Bearer ${adminUser.token}`)
      .send({ isActive: false });
    expect(deactivateRes.statusCode).toBe(200);

    const blockedMe = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${victim.token}`);
    expect(blockedMe.statusCode).toBe(403);
    expect(blockedMe.body.message).toMatch(/deactivated/i);
  });
});
