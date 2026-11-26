// server/src/modules/verification/verification.controller.js
const asyncHandler = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/response');
const verificationService = require('./verification.service');

const requestOtp = asyncHandler(async (req, res) => {
  const { collegeEmail } = req.body;
  const result = await verificationService.requestOtp({
    userId: req.user.id,
    collegeEmail,
  });

  return successResponse(res, result, 'Verification code sent to your college email.', 200);
});

const confirmOtp = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const user = await verificationService.confirmOtp({
    userId: req.user.id,
    otp,
  });

  return successResponse(res, { user }, 'Student status verified successfully.', 200);
});

const getStatus = asyncHandler(async (req, res) => {
  const status = await verificationService.getStatus(req.user.id);
  return successResponse(res, status, 'Verification status retrieved.', 200);
});

module.exports = {
  requestOtp,
  confirmOtp,
  getStatus,
};
