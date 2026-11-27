// server/prisma/fixCollegeEmails.js
require('dotenv').config();
const { prisma } = require('../src/config/db');
const config = require('../src/config');
const { validateAndNormalizeCollegeEmail } = require('../src/modules/verification/verification.service');

/**
 * Finds verified students whose collegeEmail does not strictly match ALLOWED_COLLEGE_DOMAINS.
 * Dry-run by default; pass `apply: true` (--apply) to reset their verification without touching `email`.
 */
async function fixInvalidCollegeEmails({
  apply = false,
  prismaClient = prisma,
  allowedDomains = config.verification.allowedDomains,
} = {}) {
  const verifiedUsers = await prismaClient.user.findMany({
    where: { isVerifiedStudent: true },
    select: {
      id: true,
      name: true,
      email: true,
      collegeEmail: true,
      verifiedAt: true,
    },
  });

  const nonCompliant = verifiedUsers.filter((user) => {
    const { valid } = validateAndNormalizeCollegeEmail(user.collegeEmail, allowedDomains);
    return !valid;
  });

  if (apply && nonCompliant.length > 0) {
    await prismaClient.user.updateMany({
      where: {
        id: { in: nonCompliant.map((u) => u.id) },
      },
      data: {
        isVerifiedStudent: false,
        verifiedAt: null,
        collegeEmail: null,
      },
    });
    const { invalidateAuthUserCache } = require('../src/middleware/auth');
    await Promise.all(nonCompliant.map((u) => invalidateAuthUserCache(u.id)));
  }

  return {
    checkedCount: verifiedUsers.length,
    nonCompliantUsers: nonCompliant,
    resetCount: apply ? nonCompliant.length : 0,
    applied: apply,
  };
}

if (require.main === module) {
  const apply = process.argv.includes('--apply');

  fixInvalidCollegeEmails({ apply })
    .then((result) => {
      console.log(
        `Checked ${result.checkedCount} verified student(s). Non-compliant: ${result.nonCompliantUsers.length}.`
      );
      if (result.nonCompliantUsers.length > 0) {
        console.table(
          result.nonCompliantUsers.map((u) => ({
            id: u.id,
            signupEmail: u.email,
            collegeEmail: u.collegeEmail,
          }))
        );
      }

      if (apply) {
        console.log(`Applied reset to ${result.resetCount} user(s).`);
      } else if (result.nonCompliantUsers.length > 0) {
        console.log('Dry run only. Re-run with --apply to reset verification for these users.');
      }
    })
    .catch((err) => {
      console.error('fix:college-emails failed:', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

module.exports = { fixInvalidCollegeEmails };
