// server/tests/verification.test.js
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { prisma } = require('../src/config/db');
const mailer = require('../src/utils/mailer');
const { requireVerifiedStudent } = require('../src/middleware/auth');
const { fixInvalidCollegeEmails } = require('../prisma/fixCollegeEmails');

const TEST_DOMAIN = '@verifytest.campusx.local';
const STRONG_PASSWORD = 'Password123!';
const EXPECTED_EMAIL_ERROR = 'Please use your college email ending with @chitkara.edu.in';

describe('Student Verification (@chitkara.edu.in) & requireVerifiedStudent Suite', () => {
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
      .send({ collegeEmail: 'student@chitkara.edu.in' });
    const confRes = await request(app)
      .post('/api/verification/confirm')
      .send({ otp: '123456' });
    const statusRes = await request(app).get('/api/verification/status');

    expect(reqRes.statusCode).toBe(401);
    expect(confRes.statusCode).toBe(401);
    expect(statusRes.statusCode).toBe(401);
  });

  it('should reject disallowed domains, lookalikes, subdomains, empty, and malformed college emails with 400', async () => {
    const { token } = await signupUser('baddomain');

    const invalidInputs = [
      'student@gmail.com',
      'x@chitkara.edu.in.evil.com',
      'x@mail.chitkara.edu.in',
      'x@chitkara.edu',
      '',
      '   ',
      'missingatsign.chitkara.edu.in',
      'bad space@chitkara.edu.in',
      'two@at@chitkara.edu.in',
      '@chitkara.edu.in',
      `${'a'.repeat(245)}@chitkara.edu.in`,
    ];

    for (const collegeEmail of invalidInputs) {
      const res = await request(app)
        .post('/api/verification/request')
        .set('Authorization', `Bearer ${token}`)
        .send({ collegeEmail });

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe(EXPECTED_EMAIL_ERROR);
    }

    // Missing collegeEmail field altogether
    const missingRes = await request(app)
      .post('/api/verification/request')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(missingRes.statusCode).toBe(400);
    expect(missingRes.body.message).toBe(EXPECTED_EMAIL_ERROR);

    expect(sendOtpSpy).not.toHaveBeenCalled();
  });

  it('should accept Student@Chitkara.edu.in normalized to lowercase, verify OTP, and block case-insensitive duplicates', async () => {
    const userA = await signupUser('ver_a');
    const userB = await signupUser('ver_b');
    const uniqueLocal = `Student_${Date.now()}`;
    const submittedCollegeEmail = `  ${uniqueLocal}@Chitkara.edu.in  `;
    const expectedLower = `${uniqueLocal.toLowerCase()}@chitkara.edu.in`;

    const reqRes = await request(app)
      .post('/api/verification/request')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({ collegeEmail: submittedCollegeEmail });

    expect(reqRes.statusCode).toBe(200);
    expect(reqRes.body.data.collegeEmail).toBe(expectedLower);
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
      collegeEmail: expectedLower,
    });
    expect(confirmRes.body.data.user.verifiedAt).toBeTruthy();

    // Status endpoint reflects normalized lowercase email
    const statusRes = await request(app)
      .get('/api/verification/status')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(statusRes.statusCode).toBe(200);
    expect(statusRes.body.data.isVerifiedStudent).toBe(true);
    expect(statusRes.body.data.collegeEmail).toBe(expectedLower);

    // /api/auth/me reflects verified status
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userA.token}`);
    expect(meRes.statusCode).toBe(200);
    expect(meRes.body.data.user.isVerifiedStudent).toBe(true);

    // Duplicate college email in uppercase/mixed case rejected for User B (409)
    const dupRes = await request(app)
      .post('/api/verification/request')
      .set('Authorization', `Bearer ${userB.token}`)
      .send({ collegeEmail: `${uniqueLocal.toUpperCase()}@CHITKARA.EDU.IN` });
    expect(dupRes.statusCode).toBe(409);

    // Confirm case-insensitive Prisma duplicate check even if a legacy DB row has mixed case
    const userC = await signupUser('ver_c');
    await prisma.user.update({
      where: { id: userA.user.id },
      data: { collegeEmail: `MixedCase_${uniqueLocal}@Chitkara.edu.in` },
    });
    const mixedDupRes = await request(app)
      .post('/api/verification/request')
      .set('Authorization', `Bearer ${userC.token}`)
      .send({ collegeEmail: `mixedcase_${uniqueLocal.toLowerCase()}@chitkara.edu.in` });
    expect(mixedDupRes.statusCode).toBe(409);
  });

  it('should invalidate OTP after 5 wrong attempts', async () => {
    const { token } = await signupUser('lockout');
    const collegeEmail = `lock_${Date.now()}@chitkara.edu.in`;

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

    const afterLockout = await request(app)
      .post('/api/verification/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ otp: realOtp });
    expect(afterLockout.statusCode).toBe(400);
    expect(afterLockout.body.message).toMatch(/no active verification otp/i);
  });

  it('should reject an expired OTP', async () => {
    const { user, token } = await signupUser('expired');
    const collegeEmail = `exp_${Date.now()}@chitkara.edu.in`;

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
    const collegeEmail = `rl_${Date.now()}@chitkara.edu.in`;

    const firstRes = await request(app)
      .post('/api/verification/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ collegeEmail });
    expect(firstRes.statusCode).toBe(200);

    const cooldownRes = await request(app)
      .post('/api/verification/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ collegeEmail });
    expect(cooldownRes.statusCode).toBe(429);
    expect(cooldownRes.body.message).toMatch(/wait/i);

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

    const hourlyRes = await request(app)
      .post('/api/verification/request')
      .set('Authorization', `Bearer ${token}`)
      .send({ collegeEmail });
    expect(hourlyRes.statusCode).toBe(429);
    expect(hourlyRes.body.message).toMatch(/5 verification requests per hour/i);
  });

  it('fix:college-emails script supports dry run without mutating DB and --apply resets non-chitkara verifications without touching signup email', async () => {
    const passwordHash = await bcrypt.hash(STRONG_PASSWORD, 12);
    const badSignupEmail = trackEmail(`legacy_bad_${Date.now()}${TEST_DOMAIN}`);
    const goodSignupEmail = trackEmail(`legacy_good_${Date.now()}${TEST_DOMAIN}`);

    const badUser = await prisma.user.create({
      data: {
        name: 'Legacy Non-Chitkara User',
        email: badSignupEmail,
        passwordHash,
        isVerifiedStudent: true,
        collegeEmail: `legacy_${Date.now()}@campusx.edu`,
        verifiedAt: new Date(),
      },
    });

    const goodUser = await prisma.user.create({
      data: {
        name: 'Valid Chitkara User',
        email: goodSignupEmail,
        passwordHash,
        isVerifiedStudent: true,
        collegeEmail: `valid_${Date.now()}@chitkara.edu.in`,
        verifiedAt: new Date(),
      },
    });

    // 1. Dry run reports non-compliant user and leaves DB untouched
    const dryRun = await fixInvalidCollegeEmails({ apply: false });
    expect(dryRun.applied).toBe(false);
    expect(dryRun.resetCount).toBe(0);
    expect(dryRun.nonCompliantUsers.some((u) => u.id === badUser.id)).toBe(true);
    expect(dryRun.nonCompliantUsers.some((u) => u.id === goodUser.id)).toBe(false);

    const badAfterDry = await prisma.user.findUnique({ where: { id: badUser.id } });
    expect(badAfterDry.isVerifiedStudent).toBe(true);
    expect(badAfterDry.collegeEmail).toBe(badUser.collegeEmail);

    // 2. --apply resets non-compliant verification, keeps signup email, and spares valid user
    const applied = await fixInvalidCollegeEmails({ apply: true });
    expect(applied.applied).toBe(true);
    expect(applied.resetCount).toBeGreaterThanOrEqual(1);

    const badAfterApply = await prisma.user.findUnique({ where: { id: badUser.id } });
    expect(badAfterApply.isVerifiedStudent).toBe(false);
    expect(badAfterApply.verifiedAt).toBeNull();
    expect(badAfterApply.collegeEmail).toBeNull();
    expect(badAfterApply.email).toBe(badSignupEmail);

    const goodAfterApply = await prisma.user.findUnique({ where: { id: goodUser.id } });
    expect(goodAfterApply.isVerifiedStudent).toBe(true);
    expect(goodAfterApply.collegeEmail).toBe(goodUser.collegeEmail);
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
