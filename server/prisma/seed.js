// server/prisma/seed.js
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@campusx.edu').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@CampusX2026!';
  const adminName = (process.env.ADMIN_NAME || 'CampusX Admin').trim();
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the admin account.');
  }

  const passwordHash = await bcrypt.hash(adminPassword, rounds);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      createdAt: true,
    },
  });

  console.log('Seeded ADMIN user:', admin);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
