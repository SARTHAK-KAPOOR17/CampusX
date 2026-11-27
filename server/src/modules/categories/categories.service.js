// server/src/modules/categories/categories.service.js
const { prisma } = require('../../config/db');
const config = require('../../config');
const cache = require('../../services/cache');

const CATEGORIES_CACHE_KEY = 'categories:all';

const listCategories = async () => {
  return cache.getOrSet(
    CATEGORIES_CACHE_KEY,
    config.cache.categoriesTtlSeconds,
    async () =>
      prisma.category.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          createdAt: true,
        },
      })
  );
};

module.exports = {
  listCategories,
  CATEGORIES_CACHE_KEY,
};
