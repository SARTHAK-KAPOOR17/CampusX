// server/prisma/migrateAvatars.js
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const storage = require('../src/services/storage');
const { processImageVariants, uploadVariants } = require('../src/services/images');

const LEGACY_AVATARS_DIR = path.resolve(__dirname, '../uploads/avatars');

async function migrateAvatars() {
  const prisma = new PrismaClient();
  let migrated = 0;

  try {
    await storage.ensureStorageReady();

    if (!fs.existsSync(LEGACY_AVATARS_DIR)) {
      console.log('No legacy server/uploads/avatars directory found. Nothing to migrate.');
      return;
    }

    const files = await fs.promises.readdir(LEGACY_AVATARS_DIR);
    if (files.length === 0) {
      console.log('No legacy avatar files found on disk.');
      return;
    }

    // If any users do not yet have an avatarKey, match or clean up orphaned legacy files
    for (const filename of files) {
      const fullPath = path.join(LEGACY_AVATARS_DIR, filename);
      const stat = await fs.promises.stat(fullPath);
      if (!stat.isFile()) continue;

      const userIdMatch = filename.match(
        /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i
      );

      if (!userIdMatch) {
        console.log(`Skipping unassociated legacy file ${filename}`);
        continue;
      }

      const candidateUserId = userIdMatch[1];
      const user = await prisma.user.findUnique({
        where: { id: candidateUserId },
        select: { id: true, avatarKey: true },
      });

      if (!user || user.avatarKey) continue;

      const buffer = await fs.promises.readFile(fullPath);
      const processed = await processImageVariants(buffer);
      const imageId = crypto.randomUUID();
      const baseKey = `avatars/${user.id}/${imageId}`;

      await uploadVariants(baseKey, processed.variants);
      await prisma.user.update({
        where: { id: user.id },
        data: { avatarKey: baseKey },
      });

      await fs.promises.unlink(fullPath);
      migrated += 1;
      console.log(`Migrated avatar for user ${user.id} -> ${baseKey}`);
    }

    console.log(`Avatar migration finished. Migrated ${migrated} file(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  migrateAvatars().catch((err) => {
    console.error('Avatar migration failed:', err);
    process.exit(1);
  });
}

module.exports = { migrateAvatars };
