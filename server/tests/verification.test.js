// server/tests/verification.test.js
const request = require('supertest');
const app = require('../src/app');
const { prisma } = require('../src/config/db');
const mailer = require('../src/utils/mailer');
const { requireVerifiedStudent } = require('../src/middleware/auth');

const TEST_DOMAIN = '@verifytest.campusx.local';
const STRONG_PASSWORD = 'Password123!';

describe('Student Verification & requireVerifiedStudent Suite', () => {
  const createdEmails = [];
  let sendOtpSpy;

  const trackEmail = (email) => {
    createdEmails.push(email.toLowerCase());
    return email.toLowerCase();
  };

  const signupUser = async (prefix) => {
    const email = trackEmail(`${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${TEST_DOMAIN}`);
    const res = await request(app).post('/api/auth/signup').send({
      name: `User ${prefix}`,
      email,
      password: STRONG_PASSWORD,
    });
    return {
      user: res.body.data.user,
      token: res.body.data.accessToken,
      email,
    };
  };

  beforeEach(() => {
    sendOtpSpy = jest.spyOn(mailer, 'sendVerificationOtp').mockResolvedValue({ mode: 'test' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma.user.deleteMany({
        where: { email: { in: createdEmails } },
      });
    }
    await prisma.$disconnect();
  });

  it('should block unauthenticated requests to verification endpoints with 401', async () => {
    const reqRes = await request(app)
      .post('/api/verification/request')
      .send({ collegeEmail: 'student@campusx.edu' });
    const confRes = await request(app)
      .post('/api/verification/confirm')
      .send({ otp: '123456' });
    const statusRes = await request(app).get('/api/verification/status');

    expect(reqRes.statusCode).toBe(401);
    expect(confRes.statusCode).toBe(401);
    expect(statusRes.statusCode).toBe(401);
  });

  it('should reject disallowed college email domains', async () => {
    const { token } = await signupUser('baddomain');

    const res = await request(app)
      .post('/api/verification/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ collegeEmail: 'student@gmail.com' });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/not in the allowed college domains/i);
    expect(sendOtpSpy).not.toHaveBeenCalled();
  });

  it('should verify OTP, update user & status, reflect in /api/auth/me, and reject duplicate collegeEmail for another user', async () => {
    const userA = await signupUser('ver_a');
    const userB = await signupUser('ver_b');
    const collegeEmail = `alice_${Date.now()}@campusx.edu`;

    const reqRes = await request(app)
      .post('/api/verification/request')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ collegeEmail });

    expect(reqRes.statusCode).toBe(200);
    expect(sendOtpSpy).toHaveBeenCalledTimes(1);
    const sentOtp = sendOtpSpy.mock.calls[0][0].otp;
    expect(sentOtp).toMatch(/^\d{6}$/);

    const confirmRes = await request(app)
      .post('/api/verification/confirm')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ otp: sentOtp });

    expect(confirmRes.statusCode).toBe(200);
    expect(confirmRes.body.data.user).toMatchObject({
      isVerifiedStudent: true,
      collegeEmail,
    });
    expect(confirmRes.body.data.user.verifiedAt).toBeTruthy();

    // Status endpoint reflects verified state
    const statusRes = await request(app)
      .get('/api/verification/status')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.body.data.isVerifiedStudent).toBe(true);
    expect(statusRes.body.data.collegeEmail).toBe(collegeEmail);

    // /api/auth/me also returns isVerifiedStudent: true
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(meRes.statusCode).toBe(200);
    expect(meRes.body.data.user.isVerifiedStudent).toBe(true);

    // Duplicate college email rejected for User B
    const dupRes = await request(app)
      .post('/api/verification/request')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ collegeEmail });
    expect(dupRes.statusCode).toBe(409);
  });

  it('should invalidate OTP after 5 wrong attempts', async () => {
    const { token } = await signupUser('lockout');
    const collegeEmail = `lock_${Date.now()}@mit.edu`;

    await request(app)
      .post('/api/verification/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ collegeEmail });

    const realOtp = sendOtpSpy.mock.calls[0][0].otp;
    const wrongOtp = realOtp === '000000' ? '111111' : '000000';

    for (let i = 0; i < 5; i += 1) {
      const attemptRes = await request(app)
        .post('/api/verification/confirm')
        .set('Authorization', `Bearer ${token}`)
        .send({ otp: wrongOtp });
      expect(attemptRes.statusCode).toBe(400);
    }

    // Even the real OTP is now invalidated
    const afterLockout = await request(app)
      .post('/api/verification/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ otp: realOtp });
    expect(afterLockout.statusCode).toBe(400);
    expect(afterLockout.body.message).toMatch(/no active verification otp/i);
  });

  it('should reject an expired OTP', async () => {
    const { user, token } = await signupUser('expired');
    const collegeEmail = `exp_${Date.now()}@stanford.edu`;

    await request(app)
      .post('/api/verification/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ collegeEmail });

    const realOtp = sendOtpSpy.mock.calls[0][0].otp;

    await prisma.emailOtp.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { expiresAt: new Date(Date.now() - 60 * 1000) },
    });

    const res = await request(app)
      .post('/api/verification/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ otp: realOtp });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('should enforce 60-second resend cooldown and 5 requests per hour limit', async () => {
    const { user, token } = await signupUser('ratelimit');
    const collegeEmail = `rl_${Date.now()}@campusx.edu`;

    // 1st request succeeds
    const firstRes = await request(app)
      .post('/api/verification/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ collegeEmail });
    expect(firstRes.statusCode).toBe(200);

    // Immediate 2nd request blocked by 60s cooldown
    const cooldownRes = await request(app)
      .post('/api/verification/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ collegeEmail });
    expect(cooldownRes.statusCode).toBe(429);
    expect(cooldownRes.body.message).toMatch(/wait/i);

    // Backdate existing OTP and seed 4 more within the hour (oldest > 60s ago)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    await prisma.emailOtp.updateMany({
      where: { userId: user.id },
      data: { createdAt: twoMinutesAgo },
    });

    await prisma.emailOtp.createMany({
      data: [1, 2, 3, 4].map((idx) => ({
        userId: user.id,
        collegeEmail,
        otpHash: `dummy_hash_${idx}_${Date.now()}`,
        expiresAt: new Date(Date.now() + 600000),
        consumedAt: new Date(),
        createdAt: new Date(Date.now() - (idx + 2) * 60 * 1000),
      })),
    });

    // 6th request in the past hour is blocked by hourly limit
    const hourlyRes = await request(app)
      .post('/api/verification/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ collegeEmail });
    expect(hourlyRes.statusCode).toBe(429);
    expect(hourlyRes.body.message).toMatch(/5 verification requests per hour/i);
  });

  describe('requireVerifiedStudent middleware unit test', () => {
    it('should block unauthenticated/unverified users and allow verified students', () => {
      const nextUnauth = jest.fn();
      requireVerifiedStudent({}, {}, nextUnauth);
      expect(nextUnauth).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 401 })
      );

      const nextUnverified = jest.fn();
      requireVerifiedStudent({ user: { id: 'u1', isVerifiedStudent: false } }, {}, nextUnverified);
      expect(nextUnverified).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 403 })
      );

      const nextVerified = jest.fn();
      requireVerifiedStudent({ user: { id: 'u2', isVerifiedStudent: true } }, {}, nextVerified);
      expect(nextVerified).toHaveBeenCalledWith();
    });
  });
});
