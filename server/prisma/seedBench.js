// server/prisma/seedBench.js
// DEV-ONLY BENCHMARK SEEDER: Seeds 5,000 deterministic products for search latency & EXPLAIN ANALYZE tests.
// Never run automatically in CI or container startup. Supports `--clean` to remove seeded benchmark rows.
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { prisma } = require('../src/config/db');
const { seedCategories } = require('./seed');

const TOTAL_PRODUCTS = 5000;
const BATCH_SIZE = 500;
const BENCH_SELLER_EMAIL = 'bench_seller@chitkara.edu.in';
const BENCH_TITLE_PREFIX = '[BENCH] ';

const ITEM_ADJECTIVES = ['Campus', 'Student', 'Mint', 'Compact', 'Pro', 'Classic', 'Lightweight', 'Heavy-Duty', 'Portable', 'Essential'];
const ITEM_NOUNS = [
  'Bicycle',
  'Calculus Textbook',
  'Scientific Calculator',
  'Study Desk',
  'Mechanical Keyboard',
  'Guitar',
  'Tennis Racket',
  'LED Study Lamp',
  'Hostel Kettle',
  'Wireless Mouse',
  'Drawing Board',
  'Bluetooth Speaker',
  'Lab Coat',
  'Mini Fridge',
  'Monitor Stand',
];
const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'USED'];

const deterministicUuid = (seed) => {
  const hash = crypto.createHash('md5').update(seed).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};

async function run() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run dev-only benchmark seeder in production.');
  }

  const isClean = process.argv.includes('--clean');
  if (isClean) {
    const deleted = await prisma.product.deleteMany({
      where: { title: { startsWith: BENCH_TITLE_PREFIX } },
    });
    await prisma.user.deleteMany({ where: { email: BENCH_SELLER_EMAIL } });
    console.log(`Cleaned ${deleted.count} benchmark listing(s).`);
    return;
  }

  await seedCategories(prisma);
  const categories = await prisma.category.findMany({ orderBy: { name: 'asc' } });
  const passwordHash = await bcrypt.hash('BenchPassword123!', 10);

  const seller = await prisma.user.upsert({
    where: { email: BENCH_SELLER_EMAIL },
    update: { isVerifiedStudent: true },
    create: {
      name: 'Benchmark Seller',
      email: BENCH_SELLER_EMAIL,
      passwordHash,
      role: 'STUDENT',
      isActive: true,
      isVerifiedStudent: true,
      collegeEmail: BENCH_SELLER_EMAIL,
      verifiedAt: new Date(),
    },
  });

  const now = Date.now();
  const expiresAt = new Date(now + 60 * 24 * 60 * 60 * 1000);
  let insertedTotal = 0;

  for (let offset = 0; offset < TOTAL_PRODUCTS; offset += BATCH_SIZE) {
    const rows = [];
    for (let i = 0; i < BATCH_SIZE && offset + i < TOTAL_PRODUCTS; i += 1) {
      const idx = offset + i;
      const adj = ITEM_ADJECTIVES[idx % ITEM_ADJECTIVES.length];
      const noun = ITEM_NOUNS[Math.floor(idx / ITEM_ADJECTIVES.length) % ITEM_NOUNS.length];
      const cat = categories[idx % categories.length];
      const cond = CONDITIONS[idx % CONDITIONS.length];

      rows.push({
        id: deterministicUuid(`campusx-bench-product-${idx}`),
        sellerId: seller.id,
        categoryId: cat.id,
        title: `${BENCH_TITLE_PREFIX}${adj} ${noun} #${idx + 1}`,
        description: `Well-maintained ${adj.toLowerCase()} ${noun.toLowerCase()} available for hostel pickup near Gate ${(idx % 4) + 1}.`,
        price: Number((150 + ((idx * 37) % 15000)).toFixed(2)),
        condition: cond,
        status: idx % 10 === 0 ? 'RESERVED' : 'ACTIVE',
        isNegotiable: idx % 2 === 0,
        viewCount: (idx * 13) % 400,
        tags: [noun.toLowerCase().split(' ')[0], adj.toLowerCase(), 'bench'],
        publishedAt: new Date(now - idx * 60000),
        expiresAt,
      });
    }

    const res = await prisma.product.createMany({
      data: rows,
      skipDuplicates: true,
    });
    insertedTotal += res.count;
  }

  console.log(`Benchmark seed complete (idempotent). Newly inserted: ${insertedTotal}, Target pool: ${TOTAL_PRODUCTS}.`);
}

run()
  .catch((err) => {
    console.error('seed:bench failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
