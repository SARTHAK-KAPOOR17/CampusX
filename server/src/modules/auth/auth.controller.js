// server/src/modules/auth/auth.controller.js
const config = require('../../config');
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');
const authService = require('./auth.service');

const REFRESH_COOKIE_NAME = 'refreshToken';

const getCookieOptions = () => ({
  httpOnly: true,
  secure: config.env === 'production',
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: config.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000,
});

const getClearCookieOptions = () => ({
  httpOnly: true,
  secure: config.env === 'production',
  sameSite: 'strict',
  path: '/api/auth',
});

const getRequestMeta = (req) => ({
  userAgent: req.get('user-agent') || null,
  ip: req.ip || req.connection?.remoteAddress || null,
});

const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const meta = getRequestMeta(req);

  const result = await authService.signup({
    name,
    email,
    password,
    ...meta,
  });

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getCookieOptions());

  return successResponse(
    res,
    {
      user: result.user,
      accessToken: result.accessToken,
    },
    'Account created successfully',
    201
  );
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const meta = getRequestMeta(req);

  const result = await authService.login({
    email,
    password,
    ...meta,
  });

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getCookieOptions());

  return successResponse(
    res,
    {
      user: result.user,
      accessToken: result.accessToken,
    },
    'Logged in successfully',
    200
  );
});

const refresh = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  const meta = getRequestMeta(req);

  try {
    const result = await authService.refresh({
      rawRefreshToken,
      ...meta,
    });

    res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getCookieOptions());

    return successResponse(
      res,
      {
        user: result.user,
        accessToken: result.accessToken,
      },
      'Token refreshed successfully',
      200
    );
  } catch (err) {
    res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());
    throw err;
  }
});

const logout = asyncHandler(async (req, res) => {
  const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  await authService.logout({ rawRefreshToken });
  res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());

  return successResponse(res, null, 'Logged out successfully', 200);
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll({ userId: req.user.id });
  res.clearCookie(REFRESH_COOKIE_NAME, getClearCookieOptions());

  return successResponse(res, null, 'Logged out from all devices successfully', 200);
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  return successResponse(res, { user }, 'Authenticated user retrieved', 200);
});

const googleLogin = asyncHandler(async (req, res) => {
  const { credential } = req.body;
  const meta = getRequestMeta(req);

  const result = await authService.googleAuth({
    credential,
    ...meta,
  });

  res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, getCookieOptions());

  return successResponse(
    res,
    {
      user: result.user,
      accessToken: result.accessToken,
    },
    'Google authentication successful',
    200
  );
});

const setPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  await authService.setPassword({
    userId: req.user.id,
    password,
  });

  return successResponse(res, null, 'Password set successfully', 200);
});

const getAuthConfig = asyncHandler(async (req, res) => {
  return successResponse(
    res,
    {
      googleEnabled: Boolean(config.google.clientId),
    },
    'Auth configuration retrieved',
    200
  );
});

module.exports = {
  signup,
  login,
  refresh,
  logout,
  logoutAll,
  me,
  googleLogin,
  setPassword,
  getAuthConfig,
};
