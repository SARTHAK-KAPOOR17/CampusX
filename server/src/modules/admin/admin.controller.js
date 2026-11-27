// server/src/modules/admin/admin.controller.js
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');
const adminService = require('./admin.service');

const listUsers = asyncHandler(async (req, res) => {
  const page = req.query.page || 1;
  const limit = req.query.limit || 10;

  const result = await adminService.listUsers({ page, limit });
  return successResponse(res, result, 'Users retrieved successfully', 200);
});

const updateUserRole = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  const user = await adminService.updateUserRole({
    actorId: req.user.id,
    targetUserId: id,
    role,
  });

  return successResponse(res, { user }, 'User role updated successfully', 200);
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const user = await adminService.updateUserStatus({
    actorId: req.user.id,
    targetUserId: id,
    isActive,
  });

  return successResponse(res, { user }, 'User active status updated successfully', 200);
});

module.exports = {
  listUsers,
  updateUserRole,
  updateUserStatus,
};
