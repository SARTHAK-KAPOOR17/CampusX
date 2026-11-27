// server/tests/users.test.js
const request = require('supertest');
const sharp = require('sharp');

const mockStorageStore = new Map();

jest.mock('../src/services/storage', () => ({
  putObject: jest.fn(async ({ key, body, contentType }) => {
    mockStorageStore.set(key, { body, contentType });
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
  getPublicUrl: jest.fn((key) =>
    key ? `https://cdn.campusx.test/${key}` : null
  ),
  ensureStorageReady: jest.fn(async () => true),
}));

const app = require('../src/app');
const { prisma } = require('../src/config/db');
const storage = require('../src/services/storage');

const TEST_DOMAIN = '@profiletest.campusx.local';
const STRONG_PASSWORD = 'Password123!';

describe('User Profiles & Cloud Avatar Upload Suite', () => {
  const createdEmails = [];
  let validPngBuffer;
  let validJpegBuffer;

  const trackEmail = (email) => {
    createdEmails.push(email.toLowerCase());
    return email.toLowerCase();
  };

  const signupUser = async (prefix) => {
    const email = trackEmail(
      `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${TEST_DOMAIN}`
    );
    const res = await request(app).post('/api/auth/signup').send({
      name: `Profile ${prefix}`,
      email,
      password: STRONG_PASSWORD,
    });
    return {
      user: res.body.data.user,
      token: res.body.data.accessToken,
      email,
    };
  };

  beforeAll(async () => {
    validPngBuffer = await sharp({
      create: {
        width: 120,
        height: 120,
        channels: 4,
        background: { r: 37, g: 99, b: 235, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    validJpegBuffer = await sharp({
      create: {
        width: 120,
        height: 120,
        channels: 3,
        background: { r: 16, g: 185, b: 129 },
      },
    })
      .jpeg()
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

  it('should validate profile updates and sanitize XSS in bio', async () => {
    const { token } = await signupUser('bio');

    const badYearRes = await request(app)
      .patch('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ year: 9 });
    expect(badYearRes.statusCode).toBe(422);

    const longBioRes = await request(app)
      .patch('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'a'.repeat(301) });
    expect(longBioRes.statusCode).toBe(422);

    const updateRes = await request(app)
      .patch('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Student',
        course: 'B.Tech',
        branch: 'Computer Science',
        year: 3,
        bio: '<script>alert("xss")</script>CS Junior <img src=x onerror=alert(1)>selling textbooks.',
      });

    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.body.data.user).toMatchObject({
      name: 'Updated Student',
      course: 'B.Tech',
      branch: 'Computer Science',
      year: 3,
    });
    expect(updateRes.body.data.user.bio).not.toContain('<script>');
    expect(updateRes.body.data.user.bio).not.toContain('<img');
    expect(updateRes.body.data.user.bio).toContain('CS Junior');

    const getRes = await request(app)
      .get('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(getRes.statusCode).toBe(200);
    expect(getRes.body.data.user).not.toHaveProperty('passwordHash');
    expect(getRes.body.data.user).not.toHaveProperty('avatarKey');
  });

  it('should reject wrong type, fake-extension, and >5MB files, and replace old cloud avatar variants', async () => {
    const { user, token } = await signupUser('avatar');

    // 1. Fake extension (.jpg filename + image/jpeg mimetype, plain text bytes)
    const fakeRes = await request(app)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('not-actually-an-image-just-plain-text'), {
        filename: 'evil.jpg',
        contentType: 'image/jpeg',
      });
    expect(fakeRes.statusCode).toBe(400);

    // 2. Wrong file type (.txt)
    const txtRes = await request(app)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', Buffer.from('hello world'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });
    expect(txtRes.statusCode).toBe(400);

    // 3. Oversized file (> 5MB)
    const bigBuffer = Buffer.concat([validPngBuffer, Buffer.alloc(5 * 1024 * 1024 + 100)]);
    const bigRes = await request(app)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', bigBuffer, {
        filename: 'huge.png',
        contentType: 'image/png',
      });
    expect(bigRes.statusCode).toBe(400);
    expect(bigRes.body.message).toMatch(/5MB/i);

    // 4. Valid PNG upload -> uploads 3 WebP variants to cloud storage under avatars/{userId}/
    storage.deleteObjects.mockClear();
    const pngRes = await request(app)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', validPngBuffer, {
        filename: 'avatar.png',
        contentType: 'image/png',
      });
    expect(pngRes.statusCode).toBe(200);
    expect(pngRes.body.data.user).not.toHaveProperty('avatarKey');

    const firstUrl = pngRes.body.data.user.profilePictureUrl;
    expect(firstUrl).toMatch(new RegExp(`avatars/${user.id}/.+/medium\\.webp`));

    const firstKeys = Array.from(mockStorageStore.keys()).filter((k) =>
      k.startsWith(`avatars/${user.id}/`)
    );
    expect(firstKeys.length).toBe(3);

    // 5. Replace with valid JPEG -> deletes previous 3 variants from storage
    const jpgRes = await request(app)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', validJpegBuffer, {
        filename: 'avatar2.jpg',
        contentType: 'image/jpeg',
      });
    expect(jpgRes.statusCode).toBe(200);
    expect(jpgRes.body.data.user.profilePictureUrl).not.toBe(firstUrl);
    expect(storage.deleteObjects).toHaveBeenCalledTimes(1);

    for (const oldKey of firstKeys) {
      expect(mockStorageStore.has(oldKey)).toBe(false);
    }

    const currentKeys = Array.from(mockStorageStore.keys()).filter((k) =>
      k.startsWith(`avatars/${user.id}/`)
    );
    expect(currentKeys.length).toBe(3);
  });

  it('should return public profile without leaking email, collegeEmail, role, avatarKey, or passwordHash', async () => {
    const { user, token } = await signupUser('public');

    await request(app)
      .patch('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        course: 'M.S.',
        branch: 'AI',
        year: 1,
        bio: 'Graduate researcher',
      });

    const pubRes = await request(app).get(`/api/users/${user.id}`);

    expect(pubRes.statusCode).toBe(200);
    expect(pubRes.body.data.profile).toMatchObject({
      id: user.id,
      name: user.name,
      course: 'M.S.',
      branch: 'AI',
      year: 1,
      bio: 'Graduate researcher',
      ratingAverage: 0,
      ratingCount: 0,
      isVerifiedStudent: false,
    });
    expect(pubRes.body.data.profile).not.toHaveProperty('email');
    expect(pubRes.body.data.profile).not.toHaveProperty('collegeEmail');
    expect(pubRes.body.data.profile).not.toHaveProperty('role');
    expect(pubRes.body.data.profile).not.toHaveProperty('avatarKey');
    expect(pubRes.body.data.profile).not.toHaveProperty('passwordHash');
  });
});
