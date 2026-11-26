// server/tests/products.test.js
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { prisma } = require('../src/config/db');
const { seedCategories, DEFAULT_CATEGORIES } = require('../prisma/seed');
const { expireOverdueListings } = require('../src/jobs/expireListings');

const TEST_DOMAIN = '@markettest.campusx.local';
const STRONG_PASSWORD = 'Password123!';

describe('Marketplace Core, Categories, Lifecycle & Expiry Job Suite', () => {
  const createdEmails = [];
  let categories = [];

  const trackEmail = (email) => {
    createdEmails.push(email.toLowerCase());
    return email.toLowerCase();
  };

  const createUserWithRole = async ({ prefix, role = 'STUDENT', verified = true }) => {
    const email = trackEmail(
      `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${TEST_DOMAIN}`
    );
    const passwordHash = await bcrypt.hash(STRONG_PASSWORD, 12);
    const user = await prisma.user.create({
      data: {
        name: `Market ${prefix}`,
        email,
        passwordHash,
        role,
        isActive: true,
        isVerifiedStudent: verified,
        ...(verified
          ? {
              collegeEmail: `college_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@campusx.edu`,
              verifiedAt: new Date(),
            }
          : {}),
      },
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email,
      password: STRONG_PASSWORD,
    });

    return {
      user,
      token: loginRes.body.data.accessToken,
      email,
    };
  };

  beforeAll(async () => {
    // Idempotent category seeding (ensures CI & local both have all 10 categories)
    await seedCategories(prisma);
    categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
    await prisma.$disconnect();
  });

  describe('Categories API & Idempotent Seed', () => {
    it('should seed all 10 default categories idempotently and return them sorted by name', async () => {
      // Call seedCategories a second time to verify idempotency
      await seedCategories(prisma);

      const res = await request(app).get('/api/categories');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.categories.length).toBeGreaterThanOrEqual(DEFAULT_CATEGORIES.length);

      const names = res.body.data.categories.map((c) => c.name);
      const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
      expect(names).toEqual(sortedNames);
      expect(names).toEqual(
        expect.arrayContaining(['Books', 'Electronics', 'Cycles', 'Hostel Essentials', 'Others'])
      );
    });
  });

  describe('Creation, Verification Guard & Draft vs Publish Validation', () => {
    it('should block unverified students via requireVerifiedStudent (403)', async () => {
      const unverified = await createUserWithRole({ prefix: 'unver', verified: false });

      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${unverified.token}`)
        .send({ saveAsDraft: true, title: 'Blocked Draft' });

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/verified student status is required/i);
    });

    it('should allow minimal DRAFT with only title, reject incomplete publish, and sanitize XSS', async () => {
      const seller = await createUserWithRole({ prefix: 'draft_pub', verified: true });

      // 1. Minimal draft with only title
      const draftRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${seller.token}`)
        .send({
          saveAsDraft: true,
          title: '<script>alert(1)</script>Calculus Book',
        });

      expect(draftRes.statusCode).toBe(201);
      expect(draftRes.body.data.product.status).toBe('DRAFT');
      expect(draftRes.body.data.product.title).toBe('Calculus Book');

      // 2. Incomplete publish via POST /api/products should fail validation (422)
      const badPubRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${seller.token}`)
        .send({
          saveAsDraft: false,
          title: 'Missing Fields Book',
        });
      expect(badPubRes.statusCode).toBe(422);

      // 3. Cannot publish incomplete draft via /publish
      const badDraftPublish = await request(app)
        .post(`/api/products/${draftRes.body.data.product.id}/publish`)
        .set('Authorization', `Bearer ${seller.token}`);
      expect(badDraftPublish.statusCode).toBe(422);

      // 4. Complete draft via PATCH (with XSS in description & tags) then publish
      const booksCat = categories.find((c) => c.slug === 'books');
      const patchRes = await request(app)
        .patch(`/api/products/${draftRes.body.data.product.id}`)
        .set('Authorization', `Bearer ${seller.token}`)
        .send({
          description: '<img src=x onerror=alert(9)>Clean <b>copy</b>',
          price: 499.5,
          categoryId: booksCat.id,
          condition: 'LIKE_NEW',
          tags: ['<b>math</b>', 'cs101'],
        });
      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.body.data.product.description).toBe('Clean copy');
      expect(patchRes.body.data.product.tags).toEqual(['math', 'cs101']);

      const pubRes = await request(app)
        .post(`/api/products/${draftRes.body.data.product.id}/publish`)
        .set('Authorization', `Bearer ${seller.token}`);
      expect(pubRes.statusCode).toBe(200);
      expect(pubRes.body.data.product.status).toBe('ACTIVE');
      expect(pubRes.body.data.product.publishedAt).toBeTruthy();
      expect(pubRes.body.data.product.expiresAt).toBeTruthy();
    });
  });

  describe('Lifecycle Transitions, Owner Authorization & Soft Delete', () => {
    it('should enforce owner-only edit/delete, all valid & invalid transitions, and hard vs soft delete', async () => {
      const owner = await createUserWithRole({ prefix: 'owner', verified: true });
      const otherStudent = await createUserWithRole({ prefix: 'other', verified: true });
      const admin = await createUserWithRole({ prefix: 'admin', role: 'ADMIN', verified: true });
      const cat = categories[0];

      // Create ACTIVE listing
      const createRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          saveAsDraft: false,
          title: 'Campus Bicycle',
          description: 'Good brakes and lock included',
          price: 3500,
          categoryId: cat.id,
          condition: 'GOOD',
        });
      const productId = createRes.body.data.product.id;

      // Another student gets 403 on edit, status change, and delete
      const otherEdit = await request(app)
        .patch(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${otherStudent.token}`)
        .send({ title: 'Hijacked' });
      expect(otherEdit.statusCode).toBe(403);

      const otherDel = await request(app)
        .delete(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${otherStudent.token}`);
      expect(otherDel.statusCode).toBe(403);

      // Valid transitions: ACTIVE -> RESERVED -> ACTIVE -> SOLD
      const res1 = await request(app)
        .post(`/api/products/${productId}/status`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ status: 'RESERVED' });
      expect(res1.statusCode).toBe(200);
      expect(res1.body.data.product.status).toBe('RESERVED');

      const res2 = await request(app)
        .post(`/api/products/${productId}/status`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ status: 'ACTIVE' });
      expect(res2.statusCode).toBe(200);
      expect(res2.body.data.product.status).toBe('ACTIVE');

      // Invalid: /publish on ACTIVE -> 409
      const badPub = await request(app)
        .post(`/api/products/${productId}/publish`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(badPub.statusCode).toBe(409);

      // Valid: ACTIVE -> SOLD sets soldAt
      const resSold = await request(app)
        .post(`/api/products/${productId}/status`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ status: 'SOLD' });
      expect(resSold.statusCode).toBe(200);
      expect(resSold.body.data.product.status).toBe('SOLD');
      expect(resSold.body.data.product.soldAt).toBeTruthy();

      // Invalid: edit in SOLD -> 409; transition SOLD -> ACTIVE -> 409
      const editSold = await request(app)
        .patch(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Cannot Edit Sold' });
      expect(editSold.statusCode).toBe(409);

      const soldToActive = await request(app)
        .post(`/api/products/${productId}/status`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ status: 'ACTIVE' });
      expect(soldToActive.statusCode).toBe(409);

      // Soft delete on SOLD listing by ADMIN
      const softDel = await request(app)
        .delete(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${admin.token}`);
      expect(softDel.statusCode).toBe(200);
      expect(softDel.body.data.deletionType).toBe('soft');

      const dbDeleted = await prisma.product.findUnique({ where: { id: productId } });
      expect(dbDeleted.deletedAt).not.toBeNull();

      // Excluded from detail and /mine
      const getAfterDel = await request(app).get(`/api/products/${productId}`);
      expect(getAfterDel.statusCode).toBe(404);

      // Hard delete on DRAFT listing
      const draftRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ saveAsDraft: true, title: 'Hard Delete Draft' });
      const draftId = draftRes.body.data.product.id;

      const hardDel = await request(app)
        .delete(`/api/products/${draftId}`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(hardDel.statusCode).toBe(200);
      expect(hardDel.body.data.deletionType).toBe('hard');

      const dbGone = await prisma.product.findUnique({ where: { id: draftId } });
      expect(dbGone).toBeNull();
    });
  });

  describe('Visibility, viewCount, Pagination, Moderator Flow & Expiry Job', () => {
    it('should enforce visibility for non-public statuses and increment viewCount only for non-owners', async () => {
      const owner = await createUserWithRole({ prefix: 'vis_owner', verified: true });
      const viewer = await createUserWithRole({ prefix: 'vis_viewer', verified: true });
      const mod = await createUserWithRole({ prefix: 'vis_mod', role: 'MODERATOR', verified: true });
      const cat = categories[0];

      // Create DRAFT -> hidden from anonymous and viewer, visible to owner & MODERATOR
      const draftRes = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          saveAsDraft: true,
          title: 'Private Draft',
          description: 'Draft desc',
          price: 100,
          categoryId: cat.id,
          condition: 'NEW',
        });
      const productId = draftRes.body.data.product.id;

      const anonDraft = await request(app).get(`/api/products/${productId}`);
      expect(anonDraft.statusCode).toBe(403);

      const viewerDraft = await request(app)
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${viewer.token}`);
      expect(viewerDraft.statusCode).toBe(403);

      const ownerDraft = await request(app)
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(ownerDraft.statusCode).toBe(200);
      expect(ownerDraft.body.data.product.viewCount).toBe(0);

      // Publish -> ACTIVE
      await request(app)
        .post(`/api/products/${productId}/publish`)
        .set('Authorization', `Bearer ${owner.token}`);

      // Owner view does NOT increment viewCount
      const ownerView = await request(app)
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(ownerView.body.data.product.viewCount).toBe(0);

      // Non-owner view DOES increment viewCount
      const viewerView = await request(app)
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${viewer.token}`);
      expect(viewerView.statusCode).toBe(200);
      expect(viewerView.body.data.product.viewCount).toBe(1);

      // Moderator sets UNDER_REVIEW -> hidden from public, visible to MODERATOR & owner
      const studentModAttempt = await request(app)
        .patch(`/api/admin/products/${productId}/status`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .send({ status: 'UNDER_REVIEW' });
      expect(studentModAttempt.statusCode).toBe(403);

      const modFlag = await request(app)
        .patch(`/api/admin/products/${productId}/status`)
        .set('Authorization', `Bearer ${mod.token}`)
        .send({ status: 'UNDER_REVIEW' });
      expect(modFlag.statusCode).toBe(200);
      expect(modFlag.body.data.product.status).toBe('UNDER_REVIEW');

      const publicDuringReview = await request(app).get(`/api/products/${productId}`);
      expect(publicDuringReview.statusCode).toBe(403);

      const modView = await request(app)
        .get(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${mod.token}`);
      expect(modView.statusCode).toBe(200);

      // Seller cannot self-restore from UNDER_REVIEW
      const sellerRestoreAttempt = await request(app)
        .post(`/api/products/${productId}/status`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ status: 'ACTIVE' });
      expect(sellerRestoreAttempt.statusCode).toBe(409);

      // Moderator approves back to ACTIVE
      const modApprove = await request(app)
        .patch(`/api/admin/products/${productId}/status`)
        .set('Authorization', `Bearer ${mod.token}`)
        .send({ status: 'ACTIVE' });
      expect(modApprove.statusCode).toBe(200);
      expect(modApprove.body.data.product.status).toBe('ACTIVE');
    });

    it('should paginate public feed, support ?status= on /mine, expire overdue listings, and allow relist', async () => {
      const seller = await createUserWithRole({ prefix: 'feed_seller', verified: true });
      const catA = categories[0];
      const catB = categories[1];

      // Create 3 ACTIVE items (2 in catA, 1 in catB) + 1 DRAFT
      const p1 = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${seller.token}`)
        .send({
          saveAsDraft: false,
          title: 'Item One',
          description: 'Desc 1',
          price: 100,
          categoryId: catA.id,
          condition: 'NEW',
        });

      const p2 = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${seller.token}`)
        .send({
          saveAsDraft: false,
          title: 'Item Two',
          description: 'Desc 2',
          price: 200,
          categoryId: catA.id,
          condition: 'GOOD',
        });

      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${seller.token}`)
        .send({
          saveAsDraft: false,
          title: 'Item Three',
          description: 'Desc 3',
          price: 300,
          categoryId: catB.id,
          condition: 'FAIR',
        });

      await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${seller.token}`)
        .send({ saveAsDraft: true, title: 'Seller Draft Item' });

      // Pagination limit=2
      const page1 = await request(app).get('/api/products?page=1&limit=2');
      expect(page1.statusCode).toBe(200);
      expect(page1.body.data.products.length).toBeLessThanOrEqual(2);
      expect(page1.body.data.pagination.limit).toBe(2);
      expect(page1.body.data.products[0].seller).toHaveProperty('isVerifiedStudent');
      expect(page1.body.data.products[0].seller).not.toHaveProperty('email');

      // Category filter
      const filtered = await request(app).get(`/api/products?categoryId=${catB.id}`);
      expect(filtered.statusCode).toBe(200);
      expect(filtered.body.data.products.every((p) => p.categoryId === catB.id)).toBe(true);

      // /mine with ?status=DRAFT
      const myDrafts = await request(app)
        .get('/api/products/mine?status=DRAFT')
        .set('Authorization', `Bearer ${seller.token}`);
      expect(myDrafts.statusCode).toBe(200);
      expect(myDrafts.body.data.products.length).toBe(1);
      expect(myDrafts.body.data.products[0].title).toBe('Seller Draft Item');

      // Backdate p1 expiresAt and run standalone expireOverdueListings job
      const p1Id = p1.body.data.product.id;
      const p2Id = p2.body.data.product.id;
      await prisma.product.update({
        where: { id: p1Id },
        data: { expiresAt: new Date(Date.now() - 60 * 1000) },
      });

      const expiryResult = await expireOverdueListings();
      expect(expiryResult.expiredCount).toBeGreaterThanOrEqual(1);

      const p1Db = await prisma.product.findUnique({ where: { id: p1Id } });
      const p2Db = await prisma.product.findUnique({ where: { id: p2Id } });
      expect(p1Db.status).toBe('EXPIRED');
      expect(p2Db.status).toBe('ACTIVE');

      // Seller relists EXPIRED -> ACTIVE (resets expiresAt to future)
      const relistRes = await request(app)
        .post(`/api/products/${p1Id}/status`)
        .set('Authorization', `Bearer ${seller.token}`)
        .send({ status: 'ACTIVE' });
      expect(relistRes.statusCode).toBe(200);
      expect(relistRes.body.data.product.status).toBe('ACTIVE');
      expect(new Date(relistRes.body.data.product.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });
  });
});
