// server/src/modules/search/search.service.js
const crypto = require('crypto');
const { prisma } = require('../../config/db');
const config = require('../../config');
const cache = require('../../services/cache');

const MAX_SUGGESTIONS = 8;
const POPULAR_CACHE_KEY = 'search:popular:top10';

/**
 * Returns up to 8 autocomplete suggestions combining:
 * (a) active/reserved listing titles (prefix + trigram similarity)
 * (b) matching category names
 * (c) matching popular search terms from Redis sorted set
 * Cached for 60s.
 */
const getSuggestions = async (rawQuery) => {
  const q = String(rawQuery || '').trim().slice(0, 50);
  if (q.length < 2) {
    return [];
  }

  const normalizedLower = q.toLowerCase();
  const qHash = crypto.createHash('sha256').update(normalizedLower).digest('hex');
  const cacheKey = `search:suggest:${qHash}`;

  return cache.getOrSet(cacheKey, config.cache.suggestTtlSeconds, async () => {
    const [categories, titleMatches, popularTerms] = await Promise.all([
      prisma.category.findMany({
        where: {
          name: { contains: q, mode: 'insensitive' },
        },
        take: 4,
        orderBy: { name: 'asc' },
        select: { name: true, slug: true },
      }),
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL pg_trgm.word_similarity_threshold = 0.45`;
        return tx.$queryRaw`
          SELECT "title", is_prefix, sim, "viewCount"
          FROM (
            SELECT DISTINCT ON (LOWER(p."title"))
              p."title",
              (CASE WHEN LOWER(p."title") LIKE ${`${normalizedLower}%`} OR LOWER(p."title") LIKE ${`% ${normalizedLower}%`} THEN 1 ELSE 0 END) AS is_prefix,
              word_similarity(${q}, p."title") AS sim,
              p."viewCount"
            FROM "products" p
            WHERE p."deletedAt" IS NULL
              AND p."status" IN ('ACTIVE'::"ListingStatus", 'RESERVED'::"ListingStatus")
              AND (
                p."title" ILIKE ${`${q}%`}
                OR p."title" ILIKE ${`%${q}%`}
                OR ${q} <% p."title"
              )
            ORDER BY LOWER(p."title"), p."viewCount" DESC
          ) sub
          ORDER BY is_prefix DESC, sim DESC, "viewCount" DESC
          LIMIT 8
        `;
      }),
      cache.zRevRangeWithScores('search:popular', 0, 29),
    ]);

    const sortedTitles = [...titleMatches]
      .sort((a, b) => {
        if (b.is_prefix !== a.is_prefix) return b.is_prefix - a.is_prefix;
        if (b.sim !== a.sim) return b.sim - a.sim;
        return (b.viewCount || 0) - (a.viewCount || 0);
      })
      .slice(0, 6);

    const seen = new Set();
    const suggestions = [];

    const pushUnique = (item) => {
      const key = `${item.type}:${item.text.toLowerCase()}`;
      const textKey = item.text.toLowerCase();
      if (seen.has(key) || seen.has(textKey)) return;
      seen.add(key);
      seen.add(textKey);
      suggestions.push(item);
    };

    for (const cat of categories) {
      if (suggestions.length >= MAX_SUGGESTIONS) break;
      pushUnique({ text: cat.name, type: 'category', slug: cat.slug });
    }

    for (const entry of popularTerms) {
      if (suggestions.length >= MAX_SUGGESTIONS) break;
      if (entry.term.toLowerCase().includes(normalizedLower)) {
        pushUnique({ text: entry.term, type: 'popular' });
      }
    }

    for (const row of sortedTitles) {
      if (suggestions.length >= MAX_SUGGESTIONS) break;
      pushUnique({ text: row.title, type: 'listing' });
    }

    return suggestions.slice(0, MAX_SUGGESTIONS);
  });
};

/**
 * Returns top 10 popular search terms from Redis sorted set `search:popular`, cached 5 minutes.
 */
const getPopularSearches = async () => {
  return cache.getOrSet(POPULAR_CACHE_KEY, config.cache.popularTtlSeconds, async () => {
    return cache.zRevRangeWithScores('search:popular', 0, 9);
  });
};

module.exports = {
  getSuggestions,
  getPopularSearches,
  POPULAR_CACHE_KEY,
};
