// server/src/modules/users/users.controller.js
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');
const usersService = require('./users.service');

const getMyProfile = asyncHandler(async (req, res) => {
  const user = await usersService.getMyProfile(req.user.id);
  return successResponse(res, { user }, 'Profile retrieved successfully.', 200);
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const { name, course, branch, year, bio } = req.body;
  const user = await usersService.updateMyProfile(req.user.id, {
    name,
    course,
    branch,
    year,
    bio,
  });

  return successResponse(res, { user }, 'Profile updated successfully.', 200);
});

const uploadAvatar = asyncHandler(async (req, res) => {
  const user = await usersService.updateAvatar(req.user.id, req.file);
  return successResponse(res, { user }, 'Avatar uploaded successfully.', 200);
});

const getPublicProfile = asyncHandler(async (req, res) => {
  const profile = await usersService.getPublicProfile(req.params.id);
  return successResponse(res, { profile }, 'Public profile retrieved successfully.', 200);
});

module.exports = {
  getMyProfile,
  updateMyProfile,
  uploadAvatar,
  getPublicProfile,
};
