// server/tests/images.test.js
const request = require('supertest');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');

const mockStorageStore = new Map();

jest.mock('../src/services/storage', () => ({
  putObject: jest.fn(async ({ key, body, contentType }) => {
    mockStorageStore.set(key, { body: Buffer.from(body), contentType });
    return { key };
  }),
  deleteObject: jest.fn(async (key) => {
    mockStorageStore.delete(key);
  }),
  deleteObjects: jest.fn(async (keys = []) => {
    keys.forEach((k) => mockStorageStore.delete(k));
  }),
  listObjects: jest.fn(async (prefix = '') =>
    Array.from(mockStorageStore.keys()).filter((k) => k.startsWith(prefix))
  ),
  getSignedReadUrl: jest.fn(async (key, expiresInSeconds = 900) =>
    key
      ? `https://storage.campusx.test/campusx-media/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=${expiresInSeconds}&X-Amz-Signature=mock`
      : null
  ),
  getPublicUrl: jest.fn((key) => (key ? `https://cdn.campusx.test/${key}` : null)),
  ensureStorageReady: jest.fn(async () => true),
}));

const app = require('../src/app');
const { prisma } = require('../src/config/db');
const { seedCategories } = require('../prisma/seed');
const storage = require('../src/services/storage');
const s3Storage = require('../src/services/storage/s3Storage');
const { cleanupOrphanedObjects } = require('../src/modules/product-images/productImages.service');

const TEST_DOMAIN = '@imagetest.campusx.local';
const STRONG_PASSWORD = 'Password123!';

describe('Product Images & Cloud Storage Pipeline Suite', () => {
  const createdEmails = [];
  let defaultCategory;
  let jpegWithExifBuffer;
  let smallJpegBuffer;
  let largeJpegBuffer;
  let pngBuffer;

  const trackEmail = (email) => {
    createdEmails.push(email.toLowerCase());
    return email.toLowerCase();
  };

  const createVerifiedSeller = async (prefix) => {
    const email = trackEmail(
      `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${TEST_DOMAIN}`
    );
    const passwordHash = await bcrypt.hash(STRONG_PASSWORD, 12);
    const user = await prisma.user.create({
      data: {
        name: `Seller ${prefix}`,
        email,
        passwordHash,
        role: 'STUDENT',
        isActive: true,
        isVerifiedStudent: true,
        collegeEmail: `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@chitkara.edu.in`,
        verifiedAt: new Date(),
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

  const createDraftListing = async (token, title = 'Camera Test Listing') => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${token}`)
      .send({
        saveAsDraft: true,
        title,
        description: 'Clean tested listing item',
        price: 1200,
        categoryId: defaultCategory.id,
        condition: 'GOOD',
      });
    return res.body.data.product;
  };

  beforeAll(async () => {
    await seedCategories(prisma);
    defaultCategory = await prisma.category.findFirst({ orderBy: { name: 'asc' } });

    jpegWithExifBuffer = await sharp({
      create: {
        width: 900,
        height: 600,
        channels: 3,
        background: { r: 30, g: 64, b: 175 },
      },
    })
      .jpeg()
      .withMetadata({
        exif: {
          IFD0: { Make: 'SecretPhoneMake', ImageDescription: 'GPS_SECRET_COORDS_28N_77E' },
          IFD3: { GPSLatitudeRef: 'N', GPSLongitudeRef: 'E' },
        },
      })
      .toBuffer();

    smallJpegBuffer = await sharp({
      create: {
        width: 500,
        height: 300,
        channels: 3,
        background: { r: 234, g: 179, b: 8 },
      },
    })
      .jpeg()
      .toBuffer();

    largeJpegBuffer = await sharp({
      create: {
        width: 2000,
        height: 1000,
        channels: 3,
        background: { r: 22, g: 163, b: 74 },
      },
    })
      .jpeg()
      .toBuffer();

    pngBuffer = await sharp({
      create: {
        width: 400,
        height: 400,
        channels: 4,
        background: { r: 225, g: 29, b: 72, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
  });

  afterAll(async () => {
    mockStorageStore.clear();
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
    await prisma.$disconnect();
  });

  it('generates real AWS SigV4 presigned URLs locally without network calls', async () => {
    const signedUrl = await s3Storage.getSignedReadUrl('products/p1/img1/thumb.webp', 900);
    expect(signedUrl).toContain('products/p1/img1/thumb.webp');
    expect(signedUrl).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(signedUrl).toContain('X-Amz-Expires=900');
    expect(signedUrl).toContain('X-Amz-Signature=');
  });

  it('rejects fake extensions, >5MB files, >8 images, and blocks publish without images', async () => {
    const seller = await createVerifiedSeller('val');
    const product = await createDraftListing(seller.token, 'Validation Camera');

    // Publishing with 0 images must fail (422)
    const emptyPub = await request(app)
      .post(`/api/products/${product.id}/publish`)
      .set('Authorization', `Bearer ${seller.token}`);
    expect(emptyPub.statusCode).toBe(422);
    expect(emptyPub.body.message).toMatch(/at least 1 image/i);

    // Fake .jpg (plain text bytes) -> 400
    const fakeRes = await request(app)
      .post(`/api/products/${product.id}/images`)
      .set('Authorization', `Bearer ${seller.token}`)
      .attach('images', Buffer.from('<html>not an image</html>'), {
        filename: 'fake.jpg',
        contentType: 'image/jpeg',
      });
    expect(fakeRes.statusCode).toBe(400);

    // > 5MB image -> 400
    const hugeBuf = Buffer.concat([smallJpegBuffer, Buffer.alloc(5 * 1024 * 1024 + 500)]);
    const bigRes = await request(app)
      .post(`/api/products/${product.id}/images`)
      .set('Authorization', `Bearer ${seller.token}`)
      .attach('images', hugeBuf, {
        filename: 'huge.jpg',
        contentType: 'image/jpeg',
      });
    expect(bigRes.statusCode).toBe(400);
    expect(bigRes.body.message).toMatch(/5MB/i);

    // Upload 6 valid images (max per request)
    let uploadSix = request(app)
      .post(`/api/products/${product.id}/images`)
      .set('Authorization', `Bearer ${seller.token}`);
    for (let i = 0; i < 6; i += 1) {
      uploadSix = uploadSix.attach('images', pngBuffer, {
        filename: `p_${i}.png`,
        contentType: 'image/png',
      });
    }
    const sixRes = await uploadSix;
    expect(sixRes.statusCode).toBe(201);
    expect(sixRes.body.data.images.length).toBe(6);

    // Attempt 3 more -> exceeds 8 total -> 400
    let exceedReq = request(app)
      .post(`/api/products/${product.id}/images`)
      .set('Authorization', `Bearer ${seller.token}`);
    for (let i = 0; i < 3; i += 1) {
      exceedReq = exceedReq.attach('images', smallJpegBuffer, {
        filename: `extra_${i}.jpg`,
        contentType: 'image/jpeg',
      });
    }
    const exceedRes = await exceedReq;
    expect(exceedRes.statusCode).toBe(400);
    expect(exceedRes.body.message).toMatch(/at most 8/i);
  });

  it('strips EXIF/GPS metadata, outputs 3 WebP variants without upscaling, and never leaks keys or secrets', async () => {
    const seller = await createVerifiedSeller('exif');
    const product = await createDraftListing(seller.token, 'EXIF & Variant Listing');

    // Confirm input actually contains EXIF metadata before upload
    const sourceMeta = await sharp(jpegWithExifBuffer).metadata();
    expect(sourceMeta.exif).toBeTruthy();

    // Upload 1 image with EXIF + 1 small 500x300 + 1 large 2000x1000
    const uploadRes = await request(app)
      .post(`/api/products/${product.id}/images`)
      .set('Authorization', `Bearer ${seller.token}`)
      .attach('images', jpegWithExifBuffer, { filename: 'gps.jpg', contentType: 'image/jpeg' })
      .attach('images', smallJpegBuffer, { filename: 'small.jpg', contentType: 'image/jpeg' })
      .attach('images', largeJpegBuffer, { filename: 'large.jpg', contentType: 'image/jpeg' });

    expect(uploadRes.statusCode).toBe(201);
    const uploaded = uploadRes.body.data.images;
    expect(uploaded.length).toBe(3);

    // Ensure response exposes signed URLs & blurDataUrl, NEVER storageKey or storage secrets
    const serialized = JSON.stringify(uploadRes.body);
    expect(serialized).not.toContain('storageKey');
    expect(serialized).not.toContain('avatarKey');
    if (process.env.STORAGE_SECRET_KEY) {
      expect(serialized).not.toContain(process.env.STORAGE_SECRET_KEY);
    }

    for (const img of uploaded) {
      expect(img.thumbUrl).toContain('thumb.webp');
      expect(img.mediumUrl).toContain('medium.webp');
      expect(img.largeUrl).toContain('large.webp');
      expect(img.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
    }

    // Check EXIF stripped on all 3 variants of the first image (sorted order corresponds to input order)
    const dbImages = await prisma.productImage.findMany({
      where: { productId: product.id },
      orderBy: { position: 'asc' },
    });

    for (const variant of ['thumb', 'medium', 'large']) {
      const obj = mockStorageStore.get(`${dbImages[0].storageKey}/${variant}.webp`);
      expect(obj).toBeDefined();
      expect(obj.contentType).toBe('image/webp');
      const meta = await sharp(obj.body).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.exif).toBeUndefined();
      expect(obj.body.toString('utf8')).not.toContain('GPS_SECRET_COORDS_28N_77E');
    }

    // Small source (500x300): thumb=320w, medium=500w (no upscaling!), large=500w (no upscaling!)
    const smallThumbMeta = await sharp(mockStorageStore.get(`${dbImages[1].storageKey}/thumb.webp`).body).metadata();
    const smallMedMeta = await sharp(mockStorageStore.get(`${dbImages[1].storageKey}/medium.webp`).body).metadata();
    const smallLargeMeta = await sharp(mockStorageStore.get(`${dbImages[1].storageKey}/large.webp`).body).metadata();
    expect(smallThumbMeta.width).toBe(320);
    expect(smallMedMeta.width).toBe(500);
    expect(smallLargeMeta.width).toBe(500);

    // Large source (2000x1000): thumb=320w, medium=800w, large=1600w
    const lgThumbMeta = await sharp(mockStorageStore.get(`${dbImages[2].storageKey}/thumb.webp`).body).metadata();
    const lgMedMeta = await sharp(mockStorageStore.get(`${dbImages[2].storageKey}/medium.webp`).body).metadata();
    const lgLargeMeta = await sharp(mockStorageStore.get(`${dbImages[2].storageKey}/large.webp`).body).metadata();
    expect(lgThumbMeta.width).toBe(320);
    expect(lgMedMeta.width).toBe(800);
    expect(lgLargeMeta.width).toBe(1600);
  });

  it('enforces owner-only upload/delete/reorder, promotes primary on delete, reorders cover, and cleans storage on hard delete', async () => {
    const owner = await createVerifiedSeller('own');
    const intruder = await createVerifiedSeller('intr');
    const product = await createDraftListing(owner.token, 'Ownership Gallery');

    // Intruder upload -> 403
    const intrUpload = await request(app)
      .post(`/api/products/${product.id}/images`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .attach('images', pngBuffer, { filename: 'intr.png', contentType: 'image/png' });
    expect(intrUpload.statusCode).toBe(403);

    // Owner uploads 3 images
    const upRes = await request(app)
      .post(`/api/products/${product.id}/images`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('images', pngBuffer, { filename: 'one.png', contentType: 'image/png' })
      .attach('images', smallJpegBuffer, { filename: 'two.jpg', contentType: 'image/jpeg' })
      .attach('images', smallJpegBuffer, { filename: 'three.jpg', contentType: 'image/jpeg' });
    expect(upRes.statusCode).toBe(201);
    const [img1, img2, img3] = upRes.body.data.images;
    expect(img1.isPrimary).toBe(true);
    expect(img2.isPrimary).toBe(false);

    // Intruder reorder & delete -> 403
    const intrReorder = await request(app)
      .patch(`/api/products/${product.id}/images/order`)
      .set('Authorization', `Bearer ${intruder.token}`)
      .send({ imageIds: [img3.id, img2.id, img1.id] });
    expect(intrReorder.statusCode).toBe(403);

    const intrDel = await request(app)
      .delete(`/api/products/${product.id}/images/${img1.id}`)
      .set('Authorization', `Bearer ${intruder.token}`);
    expect(intrDel.statusCode).toBe(403);

    // Reorder so img3 is first (becomes primary cover)
    const reorderRes = await request(app)
      .patch(`/api/products/${product.id}/images/order`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ imageIds: [img3.id, img1.id, img2.id] });
    expect(reorderRes.statusCode).toBe(200);
    expect(reorderRes.body.data.images[0].id).toBe(img3.id);
    expect(reorderRes.body.data.images[0].isPrimary).toBe(true);
    expect(reorderRes.body.data.images[1].isPrimary).toBe(false);

    // Delete current primary (img3) -> img1 should promote to primary
    const delRes = await request(app)
      .delete(`/api/products/${product.id}/images/${img3.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(delRes.statusCode).toBe(200);
    expect(delRes.body.data.images.length).toBe(2);
    expect(delRes.body.data.images[0].id).toBe(img1.id);
    expect(delRes.body.data.images[0].isPrimary).toBe(true);
    expect(delRes.body.data.images[0].position).toBe(0);

    // Verify deleted img3's 3 objects were removed from storage
    const img3Keys = Array.from(mockStorageStore.keys()).filter((k) => k.includes(`/${img3.id}/`));
    expect(img3Keys.length).toBe(0);

    // Now product has images -> publish succeeds
    const pubRes = await request(app)
      .post(`/api/products/${product.id}/publish`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(pubRes.statusCode).toBe(200);
    expect(pubRes.body.data.product.status).toBe('ACTIVE');

    // Hard-delete a separate draft with 2 images -> removes all 6 objects from storage
    const draft2 = await createDraftListing(owner.token, 'Hard Delete Cleanup Draft');
    await request(app)
      .post(`/api/products/${draft2.id}/images`)
      .set('Authorization', `Bearer ${owner.token}`)
      .attach('images', pngBuffer, { filename: 'd1.png', contentType: 'image/png' })
      .attach('images', pngBuffer, { filename: 'd2.png', contentType: 'image/png' });

    expect(
      Array.from(mockStorageStore.keys()).filter((k) => k.startsWith(`products/${draft2.id}/`)).length
    ).toBe(6);

    const hardDelRes = await request(app)
      .delete(`/api/products/${draft2.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(hardDelRes.statusCode).toBe(200);
    expect(hardDelRes.body.data.deletionType).toBe('hard');
    expect(
      Array.from(mockStorageStore.keys()).filter((k) => k.startsWith(`products/${draft2.id}/`)).length
    ).toBe(0);
  });

  it('serves GET /api/products in constant Prisma query count (no N+1) and cleans orphaned objects', async () => {
    const seller = await createVerifiedSeller('nplus1');

    // Seed 6 published listings with primary images
    for (let i = 0; i < 6; i += 1) {
      const draft = await createDraftListing(seller.token, `Feed Item ${i}`);
      await request(app)
        .post(`/api/products/${draft.id}/images`)
        .set('Authorization', `Bearer ${seller.token}`)
        .attach('images', pngBuffer, { filename: `f_${i}.png`, contentType: 'image/png' });
      await request(app)
        .post(`/api/products/${draft.id}/publish`)
        .set('Authorization', `Bearer ${seller.token}`);
    }

    const findManySpy = jest.spyOn(prisma.product, 'findMany');
    const countSpy = jest.spyOn(prisma.product, 'count');
    const imageFindSpy = jest.spyOn(prisma.productImage, 'findMany');

    await request(app).get('/api/products?limit=2');
    const callsFor2 = {
      productFindMany: findManySpy.mock.calls.length,
      productCount: countSpy.mock.calls.length,
      productImageFindMany: imageFindSpy.mock.calls.length,
    };

    findManySpy.mockClear();
    countSpy.mockClear();
    imageFindSpy.mockClear();

    const feedRes6 = await request(app).get('/api/products?limit=6');
    expect(feedRes6.statusCode).toBe(200);
    expect(feedRes6.body.data.products.length).toBeGreaterThanOrEqual(6);
    expect(feedRes6.body.data.products[0].primaryImage).toHaveProperty('thumbUrl');
    expect(feedRes6.body.data.products[0].primaryImage).not.toHaveProperty('storageKey');

    const callsFor6 = {
      productFindMany: findManySpy.mock.calls.length,
      productCount: countSpy.mock.calls.length,
      productImageFindMany: imageFindSpy.mock.calls.length,
    };

    expect(callsFor2).toEqual({ productFindMany: 1, productCount: 1, productImageFindMany: 0 });
    expect(callsFor6).toEqual(callsFor2);

    findManySpy.mockRestore();
    countSpy.mockRestore();
    imageFindSpy.mockRestore();

    // Unit test cleanupOrphanedObjects()
    const keysBefore = mockStorageStore.size;
    mockStorageStore.set('products/nonexistent-prod/orphan-img/thumb.webp', {
      body: Buffer.from('x'),
      contentType: 'image/webp',
    });
    mockStorageStore.set('avatars/nonexistent-user/orphan-av/medium.webp', {
      body: Buffer.from('y'),
      contentType: 'image/webp',
    });

    storage.deleteObjects.mockClear();
    const cleanupResult = await cleanupOrphanedObjects();
    expect(cleanupResult.orphanedObjectsDeleted).toBe(2);
    expect(mockStorageStore.size).toBe(keysBefore);
    expect(mockStorageStore.has('products/nonexistent-prod/orphan-img/thumb.webp')).toBe(false);
    expect(mockStorageStore.has('avatars/nonexistent-user/orphan-av/medium.webp')).toBe(false);
  });
});
