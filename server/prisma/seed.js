// server/prisma/seed.js
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DEFAULT_CATEGORIES = [
  {
    name: 'Books',
    slug: 'books',
    description: 'Course textbooks, reference manuals, novels, and study guides.',
  },
  {
    name: 'Electronics',
    slug: 'electronics',
    description: 'Laptops, calculators, monitors, headphones, and lab hardware.',
  },
  {
    name: 'Cycles',
    slug: 'cycles',
    description: 'Campus bicycles, locks, helmets, and bike accessories.',
  },
  {
    name: 'Hostel Essentials',
    slug: 'hostel-essentials',
    description: 'Kettles, fans, lamps, bedding, and dorm room necessities.',
  },
  {
    name: 'Furniture',
    slug: 'furniture',
    description: 'Study desks, chairs, shelves, and apartment furniture.',
  },
  {
    name: 'Clothing',
    slug: 'clothing',
    description: 'Apparel, jackets, campus merch, and graduation attire.',
  },
  {
    name: 'Stationery',
    slug: 'stationery',
    description: 'Notebooks, drawing kits, drafting tools, and art supplies.',
  },
  {
    name: 'Sports',
    slug: 'sports',
    description: 'Rackets, footballs, gym gear, and outdoor equipment.',
  },
  {
    name: 'Musical Instruments',
    slug: 'musical-instruments',
    description: 'Guitars, keyboards, ukuleles, and audio interfaces.',
  },
  {
    name: 'Others',
    slug: 'others',
    description: 'Miscellaneous campus items and student gear.',
  },
];

async function seedCategories(prismaClient) {
  const results = [];
  for (const cat of DEFAULT_CATEGORIES) {
    const record = await prismaClient.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        description: cat.description,
      },
      create: cat,
    });
    results.push(record);
  }
  return results;
}

async function seedAdmin(prismaClient) {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@campusx.edu').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@CampusX2026!';
  const adminName = (process.env.ADMIN_NAME || 'CampusX Admin').trim();
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

  if (!adminEmail || !adminPassword) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the admin account.');
  }

  const passwordHash = await bcrypt.hash(adminPassword, rounds);

  return prismaClient.user.upsert({
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
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const admin = await seedAdmin(prisma);
    const categories = await seedCategories(prisma);
    console.log('Seeded ADMIN user:', admin);
    console.log(`Seeded ${categories.length} marketplace categories.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_CATEGORIES,
  seedCategories,
  seedAdmin,
};
