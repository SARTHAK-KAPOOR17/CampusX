// server/tests/users.test.js
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../src/app');
const { prisma } = require('../src/config/db');
const { AVATARS_DIR } = require('../src/modules/users/users.service');

const TEST_DOMAIN = '@profiletest.campusx.local';
const STRONG_PASSWORD = 'Password123!';

// Minimal valid 1x1 PNG binary header + IHDR bytes (>= 12 bytes)
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

// Minimal valid JPEG SOI + APP0 signature (>= 12 bytes)
const VALID_JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
  0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
]);

describe('User Profiles & Avatar Upload Suite', () => {
  const createdEmails = [];
  const uploadedFiles = [];

  const trackEmail = (email) => {
    createdEmails.push(email.toLowerCase());
    return email.toLowerCase();
  };

  const signupUser = async (prefix) => {
    const email = trackEmail(`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${TEST_DOMAIN}`);
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

  afterAll(async () => {
    for (const fileUrl of uploadedFiles) {
      const fullPath = path.join(AVATARS_DIR, path.basename(fileUrl));
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
    await prisma.$disconnect();
  });

  it('should validate profile updates and sanitize XSS in bio', async () => {
    const { token } = await signupUser('bio');

    // Invalid year (> 6)
    const badYearRes = await request(app)
      .patch('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ year: 9 });
    expect(badYearRes.statusCode).toBe(422);

    // Bio exceeding 300 chars
    const longBioRes = await request(app)
      .patch('/api/users/me/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'a'.repeat(301) });
    expect(longBioRes.statusCode).toBe(422);

    // Valid profile update with XSS payload in bio
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
  });

  it('should reject wrong type, fake-extension, and oversized files, and replace old avatar cleanly', async () => {
    const { token } = await signupUser('avatar');

    // 1. Fake extension (.jpg filename + image/jpeg mimetype, but plain text bytes)
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

    // 3. Oversized file (> 2MB)
    const bigBuffer = Buffer.concat([VALID_PNG_BUFFER, Buffer.alloc(2 * 1024 * 1024 + 100)]);
    const bigRes = await request(app)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', bigBuffer, {
        filename: 'huge.png',
        contentType: 'image/png',
      });
    expect(bigRes.statusCode).toBe(400);
    expect(bigRes.body.message).toMatch(/2MB/i);

    // 4. Valid PNG upload
    const pngRes = await request(app)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', VALID_PNG_BUFFER, {
        filename: 'avatar.png',
        contentType: 'image/png',
      });
    expect(pngRes.statusCode).toBe(200);
    const firstUrl = pngRes.body.data.user.profilePictureUrl;
    expect(firstUrl).toMatch(/^\/uploads\/avatars\/.+\.png$/);
    uploadedFiles.push(firstUrl);

    const firstDiskPath = path.join(AVATARS_DIR, path.basename(firstUrl));
    expect(fs.existsSync(firstDiskPath)).toBe(true);

    // 5. Replace with valid JPEG -> deletes first PNG file from disk
    const jpgRes = await request(app)
      .post('/api/users/me/avatar')
      .set('Authorization', `Bearer ${token}`)
      .attach('avatar', VALID_JPEG_BUFFER, {
        filename: 'avatar2.jpg',
        contentType: 'image/jpeg',
      });
    expect(jpgRes.statusCode).toBe(200);
    const secondUrl = jpgRes.body.data.user.profilePictureUrl;
    expect(secondUrl).toMatch(/^\/uploads\/avatars\/.+\.jpg$/);
    uploadedFiles.push(secondUrl);

    expect(fs.existsSync(firstDiskPath)).toBe(false);
    expect(fs.existsSync(path.join(AVATARS_DIR, path.basename(secondUrl)))).toBe(true);
  });

  it('should return public profile without leaking email, collegeEmail, role, or passwordHash', async () => {
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
    expect(pubRes.body.data.profile).not.toHaveProperty('passwordHash');
  });
});
