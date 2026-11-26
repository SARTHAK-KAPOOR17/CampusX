// server/tests/auth.test.js
const crypto = require('crypto');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { prisma } = require('../src/config/db');

const TEST_DOMAIN = '@test.campusx.local';
const STRONG_PASSWORD = 'Password123!';

const extractCookies = (res) => {
  const raw = res.headers['set-cookie'] || [];
  return raw.reduce((acc, cookieStr) => {
    const [pair] = cookieStr.split(';');
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0) {
      const name = pair.slice(0, eqIndex).trim();
      const value = pair.slice(eqIndex + 1).trim();
      acc[name] = { value, raw: cookieStr };
    }
    return acc;
  }, {});
};

describe('Auth & RBAC Integration Suite', () => {
  const createdEmails = [];

  const trackEmail = (email) => {
    createdEmails.push(email.toLowerCase());
    return email.toLowerCase();
  };

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
    await prisma.$disconnect();
  });

  describe('POST /api/auth/signup', () => {
    it('should register a new STUDENT, hash password with bcrypt (12 rounds), store hashed refresh token, and set httpOnly cookie', async () => {
      const email = trackEmail(`student1_${Date.now()}${TEST_DOMAIN}`);
      const res = await request(app).post('/api/auth/signup').send({
        name: 'Alice Student',
        email,
        password: STRONG_PASSWORD,
      });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.user).toMatchObject({
        name: 'Alice Student',
        email,
        role: 'STUDENT',
        isActive: true,
      });
      expect(res.body.data.user).not.toHaveProperty('passwordHash');

      const cookies = extractCookies(res);
      expect(cookies.refreshToken).toBeDefined();
      expect(cookies.refreshToken.value.length).toBe(128); // 64 bytes hex = 128 chars
      expect(cookies.refreshToken.raw.toLowerCase()).toContain('httponly');
      expect(cookies.refreshToken.raw.toLowerCase()).toContain('samesite=strict');

      const dbUser = await prisma.user.findUnique({
        where: { email },
        include: { refreshTokens: true },
      });
      expect(dbUser).not.toBeNull();
      expect(dbUser.passwordHash).not.toBe(STRONG_PASSWORD);
      expect(bcrypt.getRounds(dbUser.passwordHash)).toBe(12);
      expect(dbUser.refreshTokens.length).toBe(1);

      const expectedHash = crypto
        .createHash('sha256')
        .update(cookies.refreshToken.value)
        .digest('hex');
      expect(dbUser.refreshTokens[0].tokenHash).toBe(expectedHash);
      expect(dbUser.refreshTokens[0].tokenHash).not.toBe(cookies.refreshToken.value);
    });

    it('should reject duplicate email with 409', async () => {
      const email = trackEmail(`dup_${Date.now()}${TEST_DOMAIN}`);
      await request(app).post('/api/auth/signup').send({
        name: 'First User',
        email,
        password: STRONG_PASSWORD,
      });

      const res = await request(app).post('/api/auth/signup').send({
        name: 'Second User',
        email,
        password: STRONG_PASSWORD,
      });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should reject weak passwords with 422 validation error', async () => {
      const email = trackEmail(`weak_${Date.now()}${TEST_DOMAIN}`);
      const res = await request(app).post('/api/auth/signup').send({
        name: 'Weak Pw User',
        email,
        password: 'weak',
      });

      expect(res.statusCode).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'password' })])
      );
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully and return accessToken in body + refreshToken cookie', async () => {
      const email = trackEmail(`login_ok_${Date.now()}${TEST_DOMAIN}`);
      await request(app).post('/api/auth/signup').send({
        name: 'Login User',
        email,
        password: STRONG_PASSWORD,
      });

      const res = await request(app).post('/api/auth/login').send({
        email,
        password: STRONG_PASSWORD,
      });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.user).not.toHaveProperty('passwordHash');

      const cookies = extractCookies(res);
      expect(cookies.refreshToken).toBeDefined();
      expect(cookies.refreshToken.raw.toLowerCase()).toContain('httponly');
    });

    it('should return generic 401 message for wrong password and nonexistent email', async () => {
      const email = trackEmail(`login_bad_${Date.now()}${TEST_DOMAIN}`);
      await request(app).post('/api/auth/signup').send({
        name: 'Bad Login User',
        email,
        password: STRONG_PASSWORD,
      });

      const wrongPwRes = await request(app).post('/api/auth/login').send({
        email,
        password: 'WrongPassword1!',
      });

      const unknownEmailRes = await request(app).post('/api/auth/login').send({
        email: `missing_${Date.now()}${TEST_DOMAIN}`,
        password: STRONG_PASSWORD,
      });

      expect(wrongPwRes.statusCode).toBe(401);
      expect(unknownEmailRes.statusCode).toBe(401);
      expect(wrongPwRes.body.message).toBe('Invalid email or password.');
      expect(unknownEmailRes.body.message).toBe('Invalid email or password.');
    });
  });

  describe('POST /api/auth/refresh (rotation & reuse detection)', () => {
    it('should rotate refresh token and issue a new pair', async () => {
      const email = trackEmail(`rotate_${Date.now()}${TEST_DOMAIN}`);
      const signupRes = await request(app).post('/api/auth/signup').send({
        name: 'Rotate User',
        email,
        password: STRONG_PASSWORD,
      });
      const oldCookie = extractCookies(signupRes).refreshToken.value;

      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${oldCookie}`]);

      expect(refreshRes.statusCode).toBe(200);
      expect(refreshRes.body.data.accessToken).toEqual(expect.any(String));
      const newCookie = extractCookies(refreshRes).refreshToken.value;
      expect(newCookie).toBeDefined();
      expect(newCookie).not.toBe(oldCookie);

      const oldTokenHash = crypto.createHash('sha256').update(oldCookie).digest('hex');
      const oldDbToken = await prisma.refreshToken.findUnique({
        where: { tokenHash: oldTokenHash },
      });
      expect(oldDbToken.revokedAt).not.toBeNull();
    });

    it('should detect reuse of a revoked refresh token and revoke ALL tokens of that user', async () => {
      const email = trackEmail(`reuse_${Date.now()}${TEST_DOMAIN}`);
      const signupRes = await request(app).post('/api/auth/signup').send({
        name: 'Reuse Victim',
        email,
        password: STRONG_PASSWORD,
      });
      const token1 = extractCookies(signupRes).refreshToken.value;

      // Rotate token1 -> token2
      const refresh1 = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${token1}`]);
      expect(refresh1.statusCode).toBe(200);
      const token2 = extractCookies(refresh1).refreshToken.value;

      // Reuse already-revoked token1 -> triggers compromise detection
      const reuseRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${token1}`]);
      expect(reuseRes.statusCode).toBe(401);
      expect(reuseRes.body.message).toMatch(/reuse detected/i);

      // Verify token2 was ALSO revoked automatically!
      const token2Res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${token2}`]);
      expect(token2Res.statusCode).toBe(401);
    });
  });

  describe('POST /api/auth/logout & GET /api/auth/me', () => {
    it('should return current user on /api/auth/me with token and 401 without token', async () => {
      const noTokenRes = await request(app).get('/api/auth/me');
      expect(noTokenRes.statusCode).toBe(401);

      const email = trackEmail(`me_${Date.now()}${TEST_DOMAIN}`);
      const signupRes = await request(app).post('/api/auth/signup').send({
        name: 'Me User',
        email,
        password: STRONG_PASSWORD,
      });
      const { accessToken } = signupRes.body.data;

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meRes.statusCode).toBe(200);
      expect(meRes.body.data.user).toMatchObject({
        name: 'Me User',
        email,
        role: 'STUDENT',
      });
      expect(meRes.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should reject inactive users in authenticate middleware', async () => {
      const email = trackEmail(`inactive_${Date.now()}${TEST_DOMAIN}`);
      const signupRes = await request(app).post('/api/auth/signup').send({
        name: 'Inactive User',
        email,
        password: STRONG_PASSWORD,
      });
      const { accessToken } = signupRes.body.data;

      await prisma.user.update({
        where: { email },
        data: { isActive: false },
      });

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meRes.statusCode).toBe(403);
    });

    it('should revoke refresh token on logout and block subsequent refresh', async () => {
      const email = trackEmail(`logout_${Date.now()}${TEST_DOMAIN}`);
      const signupRes = await request(app).post('/api/auth/signup').send({
        name: 'Logout User',
        email,
        password: STRONG_PASSWORD,
      });
      const refreshCookie = extractCookies(signupRes).refreshToken.value;

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [`refreshToken=${refreshCookie}`]);
      expect(logoutRes.statusCode).toBe(200);

      const afterLogoutRefresh = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${refreshCookie}`]);
      expect(afterLogoutRefresh.statusCode).toBe(401);
    });
  });

  describe('RBAC & Admin Role Management (/api/admin)', () => {
    it('should block STUDENT from admin routes via authorize() and allow ADMIN to list users and update roles without self-demotion', async () => {
      const studentEmail = trackEmail(`rbac_student_${Date.now()}${TEST_DOMAIN}`);
      const adminEmail = trackEmail(`rbac_admin_${Date.now()}${TEST_DOMAIN}`);

      // Create STUDENT via signup
      const studentSignup = await request(app).post('/api/auth/signup').send({
        name: 'RBAC Student',
        email: studentEmail,
        password: STRONG_PASSWORD,
      });
      const studentToken = studentSignup.body.data.accessToken;
      const studentId = studentSignup.body.data.user.id;

      // Create ADMIN in DB and log in
      const adminHash = await bcrypt.hash(STRONG_PASSWORD, 12);
      const adminUser = await prisma.user.create({
        data: {
          name: 'RBAC Admin',
          email: adminEmail,
          passwordHash: adminHash,
          role: 'ADMIN',
          isActive: true,
        },
      });
      const adminLogin = await request(app).post('/api/auth/login').send({
        email: adminEmail,
        password: STRONG_PASSWORD,
      });
      const adminToken = adminLogin.body.data.accessToken;

      // 1. STUDENT is blocked from GET /api/admin/users and PATCH /api/admin/users/:id/role
      const studentListRes = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(studentListRes.statusCode).toBe(403);

      const studentPatchRes = await request(app)
        .patch(`/api/admin/users/${studentId}/role`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ role: 'ADMIN' });
      expect(studentPatchRes.statusCode).toBe(403);

      // 2. ADMIN can list paginated users (without passwordHash)
      const adminListRes = await request(app)
        .get('/api/admin/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminListRes.statusCode).toBe(200);
      expect(Array.isArray(adminListRes.body.data.users)).toBe(true);
      expect(adminListRes.body.data.pagination).toMatchObject({
        page: 1,
        limit: 5,
      });
      adminListRes.body.data.users.forEach((u) => {
        expect(u).not.toHaveProperty('passwordHash');
      });

      // 3. ADMIN can promote STUDENT to MODERATOR
      const promoteRes = await request(app)
        .patch(`/api/admin/users/${studentId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'MODERATOR' });
      expect(promoteRes.statusCode).toBe(200);
      expect(promoteRes.body.data.user.role).toBe('MODERATOR');

      // 4. MODERATOR can GET /api/admin/users, but CANNOT PATCH roles
      const modLogin = await request(app).post('/api/auth/login').send({
        email: studentEmail,
        password: STRONG_PASSWORD,
      });
      const modToken = modLogin.body.data.accessToken;

      const modListRes = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${modToken}`);
      expect(modListRes.statusCode).toBe(200);

      const modPatchRes = await request(app)
        .patch(`/api/admin/users/${adminUser.id}/role`)
        .set('Authorization', `Bearer ${modToken}`)
        .send({ role: 'STUDENT' });
      expect(modPatchRes.statusCode).toBe(403);

      // 5. ADMIN cannot demote themselves
      const selfDemoteRes = await request(app)
        .patch(`/api/admin/users/${adminUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'STUDENT' });
      expect(selfDemoteRes.statusCode).toBe(400);
      expect(selfDemoteRes.body.message).toMatch(/cannot demote themselves/i);
    });
  });
});
