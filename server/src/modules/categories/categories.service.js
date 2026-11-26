// server/src/modules/categories/categories.service.js
const { prisma } = require('../../config/db');

const listCategories = async () => {
  return prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
    },
  });
};

module.exports = {
  listCategories,
};
