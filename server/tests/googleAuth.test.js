// server/tests/googleAuth.test.js
const request = require('supertest');

const mockVerifyIdToken = jest.fn();

jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => {
      return {
        verifyIdToken: mockVerifyIdToken,
      };
    }),
  };
});

const app = require('../src/app');
const config = require('../src/config');
const { prisma } = require('../src/config/db');
const validator = require('validator');

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

describe('Google Auth Integration Suite (Day 7B)', () => {
  const createdEmails = [];
  const originalClientId = config.google.clientId;
  const originalAutoVerify = config.google.autoVerifyCollege;

  const trackEmail = (email) => {
    const norm = validator.normalizeEmail(email) || email.toLowerCase().trim();
    createdEmails.push(norm);
    return norm;
  };

  beforeAll(() => {
    config.google.clientId = 'test-client-id.apps.googleusercontent.com';
    config.google.autoVerifyCollege = true;
  });

  afterAll(async () => {
    config.google.clientId = originalClientId;
    config.google.autoVerifyCollege = originalAutoVerify;

    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/auth/config', () => {
    it('should return googleEnabled flag matching clientId presence', async () => {
      const res = await request(app).get('/api/auth/config');
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.googleEnabled).toBe(true);
    });

    it('should return googleEnabled: false when clientId is empty', async () => {
      config.google.clientId = '';
      const res = await request(app).get('/api/auth/config');
      expect(res.statusCode).toBe(200);
      expect(res.body.data.googleEnabled).toBe(false);
      config.google.clientId = 'test-client-id.apps.googleusercontent.com';
    });
  });

  describe('POST /api/auth/google - Unconfigured Server', () => {
    it('should return 503 if GOOGLE_CLIENT_ID is not configured', async () => {
      config.google.clientId = '';
      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'dummy-token' });

      expect(res.statusCode).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not configured/i);

      config.google.clientId = 'test-client-id.apps.googleusercontent.com';
    });
  });

  describe('POST /api/auth/google - Token Validations', () => {
    it('should reject when credential is missing', async () => {
      const res = await request(app).post('/api/auth/google').send({});
      expect([400, 422]).toContain(res.statusCode);
      expect(res.body.success).toBe(false);
    });

    it('should reject if audience does not match client ID', async () => {
      mockVerifyIdToken.mockRejectedValueOnce(
        new Error('Wrong recipient, payload audience != requiredAudience')
      );

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'mismatched-aud-token' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/invalid or expired/i);
    });

    it('should reject if email_verified is false', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: 'google-sub-unverified',
          email: 'unverified@gmail.com',
          email_verified: false,
          name: 'Unverified User',
        }),
      });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'unverified-email-token' });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/not verified/i);
    });
  });

  describe('POST /api/auth/google - New & Existing User Flows', () => {
    it('should successfully create and authenticate a new Google user', async () => {
      const email = trackEmail(`google.new.${Date.now()}@gmail.com`);
      const googleSub = `sub_${Date.now()}`;

      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: googleSub,
          email,
          email_verified: true,
          name: 'Google Rookie',
        }),
      });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'valid-new-user-token' });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toEqual(expect.any(String));
      expect(res.body.data.user).toMatchObject({
        email,
        name: 'Google Rookie',
        role: 'STUDENT',
        authProvider: 'GOOGLE',
        hasPassword: false,
      });

      const cookies = extractCookies(res);
      expect(cookies.refreshToken).toBeDefined();

      // Verify DB record
      const dbUser = await prisma.user.findUnique({ where: { email } });
      expect(dbUser).toBeDefined();
      expect(dbUser.googleId).toBe(googleSub);
      expect(dbUser.passwordHash).toBeNull();
      expect(dbUser.emailVerified).toBe(true);
      expect(dbUser.authProvider).toBe('GOOGLE');
    });

    it('should successfully log in an existing Google user', async () => {
      const email = trackEmail(`google.repeat.${Date.now()}@gmail.com`);
      const googleSub = `sub_repeat_${Date.now()}`;

      // First login (creates user)
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: googleSub,
          email,
          email_verified: true,
          name: 'Repeat User',
        }),
      });

      await request(app)
        .post('/api/auth/google')
        .send({ credential: 'token-1' });

      // Second login
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: googleSub,
          email,
          email_verified: true,
          name: 'Repeat User',
        }),
      });

      const res2 = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'token-2' });

      expect(res2.statusCode).toBe(200);
      expect(res2.body.data.user.email).toBe(email);
    });
  });

  describe('POST /api/auth/google - Account Linking & Security', () => {
    it('should link googleId to existing verified user without clearing password', async () => {
      const email = trackEmail(`verified.local.${Date.now()}@example.com`);
      const googleSub = `sub_link_verified_${Date.now()}`;

      // Create verified local user
      const signupRes = await request(app).post('/api/auth/signup').send({
        name: 'Verified Local',
        email,
        password: 'Password123!',
      });
      expect(signupRes.statusCode).toBe(201);

      await prisma.user.update({
        where: { email },
        data: { emailVerified: true },
      });

      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: googleSub,
          email,
          email_verified: true,
          name: 'Verified Local Google',
        }),
      });

      const linkRes = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'token-link' });

      expect(linkRes.statusCode).toBe(200);

      const dbUser = await prisma.user.findUnique({ where: { email } });
      expect(dbUser.googleId).toBe(googleSub);
      expect(dbUser.passwordHash).not.toBeNull();
    });

    it('should secure unverified local account by nulling password and revoking refresh tokens on Google link', async () => {
      const email = trackEmail(`unverified.target.${Date.now()}@example.com`);
      const googleSub = `sub_sec_${Date.now()}`;

      // Attacker pre-registers the victim's email locally
      const attackerSignup = await request(app).post('/api/auth/signup').send({
        name: 'Victim Name',
        email,
        password: 'AttackerPassword123!',
      });
      expect(attackerSignup.statusCode).toBe(201);
      const attackerCookies = extractCookies(attackerSignup);

      // Legitimate victim signs in with Google
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: googleSub,
          email,
          email_verified: true,
          name: 'Real User Name',
        }),
      });

      const victimGoogleRes = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'token-victim' });

      expect(victimGoogleRes.statusCode).toBe(200);

      // Verify security actions occurred:
      const dbUser = await prisma.user.findUnique({ where: { email } });
      expect(dbUser.googleId).toBe(googleSub);
      expect(dbUser.emailVerified).toBe(true);
      expect(dbUser.passwordHash).toBeNull(); // Attacker password cleared

      // Attacker refresh token revoked
      const attackerRefreshRes = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', `refreshToken=${attackerCookies.refreshToken.value}`);
      expect(attackerRefreshRes.statusCode).toBe(401);

      // Attacker cannot log in with previous password
      const attackerLogin = await request(app).post('/api/auth/login').send({
        email,
        password: 'AttackerPassword123!',
      });
      expect(attackerLogin.statusCode).toBe(401);
      expect(attackerLogin.body.message).toBe('Invalid email or password.');
    });
  });

  describe('POST /api/auth/google - College Auto-Verification', () => {
    it('should auto-verify student if email and hd claim strictly match @chitkara.edu.in', async () => {
      const email = trackEmail(`chitkara.student.${Date.now()}@chitkara.edu.in`);
      const googleSub = `sub_chitkara_${Date.now()}`;

      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: googleSub,
          email,
          email_verified: true,
          hd: 'chitkara.edu.in',
          name: 'Chitkara Student',
        }),
      });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'token-chitkara' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.user.isVerifiedStudent).toBe(true);
      expect(res.body.data.user.collegeEmail).toBe(email);

      const dbUser = await prisma.user.findUnique({ where: { email } });
      expect(dbUser.isVerifiedStudent).toBe(true);
      expect(dbUser.collegeEmail).toBe(email);
      expect(dbUser.verifiedAt).not.toBeNull();
    });

    it('should NOT auto-verify non-college Google accounts', async () => {
      const email = trackEmail(`outsider.${Date.now()}@gmail.com`);
      const googleSub = `sub_out_${Date.now()}`;

      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: googleSub,
          email,
          email_verified: true,
          name: 'Outsider User',
        }),
      });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'token-out' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.user.isVerifiedStudent).toBe(false);

      const dbUser = await prisma.user.findUnique({ where: { email } });
      expect(dbUser.isVerifiedStudent).toBe(false);
      expect(dbUser.collegeEmail).toBeNull();
    });

    it('should reject auto-verify for college lookalike domain (chitkara.edu.in.evil.com)', async () => {
      const email = trackEmail(`phisher.${Date.now()}@chitkara.edu.in.evil.com`);
      const googleSub = `sub_evil_${Date.now()}`;

      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: googleSub,
          email,
          email_verified: true,
          hd: 'chitkara.edu.in.evil.com',
          name: 'Evil Domain User',
        }),
      });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'token-evil' });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.user.isVerifiedStudent).toBe(false);

      const dbUser = await prisma.user.findUnique({ where: { email } });
      expect(dbUser.isVerifiedStudent).toBe(false);
      expect(dbUser.collegeEmail).toBeNull();
    });
  });

  describe('POST /api/auth/login - Google Account Restrictions', () => {
    it('should return generic 401 if a Google user with null passwordHash attempts password login', async () => {
      const email = trackEmail(`google.only.${Date.now()}@gmail.com`);
      const googleSub = `sub_pwless_${Date.now()}`;

      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: googleSub,
          email,
          email_verified: true,
          name: 'No Password User',
        }),
      });

      await request(app)
        .post('/api/auth/google')
        .send({ credential: 'token-pwless' });

      const loginRes = await request(app).post('/api/auth/login').send({
        email,
        password: 'AnyPassword123!',
      });

      expect(loginRes.statusCode).toBe(401);
      expect(loginRes.body.message).toBe('Invalid email or password.');
    });
  });

  describe('POST /api/auth/set-password & GET /api/auth/me', () => {
    it('allows Google user to set a password and then log in using either method', async () => {
      const email = trackEmail(`google.hybrid.${Date.now()}@gmail.com`);
      const googleSub = `sub_hybrid_${Date.now()}`;

      // 1. Google Login
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: googleSub,
          email,
          email_verified: true,
          name: 'Hybrid User',
        }),
      });

      const googleRes = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'token-hybrid' });

      const { accessToken } = googleRes.body.data;

      // 2. Check /api/auth/me before setting password
      const meRes1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meRes1.statusCode).toBe(200);
      expect(meRes1.body.data.user.authProvider).toBe('GOOGLE');
      expect(meRes1.body.data.user.hasPassword).toBe(false);

      // 3. Set password with weak password (rejected)
      const weakRes = await request(app)
        .post('/api/auth/set-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: 'weak' });
      expect([400, 422]).toContain(weakRes.statusCode);

      // 4. Set password with strong password (accepted)
      const newPassword = 'SecureHybrid123!';
      const setPwRes = await request(app)
        .post('/api/auth/set-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ password: newPassword });

      expect(setPwRes.statusCode).toBe(200);
      expect(setPwRes.body.success).toBe(true);

      // 5. Check /api/auth/me after setting password
      const meRes2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meRes2.statusCode).toBe(200);
      expect(meRes2.body.data.user.hasPassword).toBe(true);

      // 6. Log in via email/password
      const emailLoginRes = await request(app).post('/api/auth/login').send({
        email,
        password: newPassword,
      });

      expect(emailLoginRes.statusCode).toBe(200);
      expect(emailLoginRes.body.data.user.email).toBe(email);
    });
  });
});
