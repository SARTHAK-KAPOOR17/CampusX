// server/src/services/cache/index.js
const crypto = require('crypto');
const Redis = require('ioredis');
const config = require('../../config');
const logger = require('../../utils/logger');

let client = null;
let lastWarnAt = 0;
let forceDisabled = false;
const inFlightRequests = new Map();

const WARN_THROTTLE_MS = 10000;

const warnOnce = (message, err) => {
  const now = Date.now();
  if (now - lastWarnAt > WARN_THROTTLE_MS) {
    lastWarnAt = now;
    logger.warn({ err: err?.message || err }, message);
  }
};

const namespacePrefix = () => `campusx:${config.env}:`;

const prefixKey = (key) => `${namespacePrefix()}${key}`;

/**
 * Lazily initializes and returns the shared ioredis client.
 * Fails fast without offline queueing so Redis outages never block API requests.
 */
const getClient = () => {
  if (forceDisabled) return null;
  if (client) return client;

  client = new Redis(config.redis.url, {
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    retryStrategy(times) {
      return Math.min(times * 250, 3000);
    },
  });

  client.on('error', (err) => {
    warnOnce('Redis cache error (failing open to PostgreSQL)', err);
  });

  return client;
};

const isReady = () => {
  if (forceDisabled) return false;
  const redis = getClient();
  return Boolean(redis && redis.status === 'ready');
};

const get = async (key) => {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return null;
    const raw = await redis.get(prefixKey(key));
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (err) {
    warnOnce(`Redis GET failed for key '${key}'`, err);
    return null;
  }
};

const set = async (key, value, ttlSeconds = config.cache.defaultTtlSeconds) => {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return false;
    const payload = JSON.stringify(value);
    const safeTtl = Math.max(1, Math.floor(Number(ttlSeconds) || config.cache.defaultTtlSeconds));
    await redis.set(prefixKey(key), payload, 'EX', safeTtl);
    return true;
  } catch (err) {
    warnOnce(`Redis SET failed for key '${key}'`, err);
    return false;
  }
};

const del = async (key) => {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return 0;
    return await redis.del(prefixKey(key));
  } catch (err) {
    warnOnce(`Redis DEL failed for key '${key}'`, err);
    return 0;
  }
};

/**
 * Deletes all keys matching a logical prefix using cursor-based SCAN (never KEYS).
 */
const delByPrefix = async (prefix) => {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return 0;

    const pattern = `${prefixKey(prefix)}*`;
    let cursor = '0';
    let deletedCount = 0;

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (Array.isArray(keys) && keys.length > 0) {
        deletedCount += await redis.del(...keys);
      }
    } while (cursor !== '0');

    return deletedCount;
  } catch (err) {
    warnOnce(`Redis SCAN/DEL failed for prefix '${prefix}'`, err);
    return 0;
  }
};

/**
 * Increments a counter and sets an expiry on initial creation.
 * Returns the updated count or null when Redis is unavailable.
 */
const incr = async (key, ttlSeconds = config.cache.defaultTtlSeconds) => {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return null;

    const fullKey = prefixKey(key);
    const nextVal = await redis.incr(fullKey);
    if (nextVal === 1 && ttlSeconds > 0) {
      await redis.expire(fullKey, Math.max(1, Math.floor(ttlSeconds)));
    }
    return nextVal;
  } catch (err) {
    warnOnce(`Redis INCR failed for key '${key}'`, err);
    return null;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cache-aside helper with in-process singleflight coalescing and Redis NX lock
 * for stampede protection. Always fails open to `fetcher` if Redis is down.
 */
const getOrSet = async (key, ttlSeconds, fetcher, { lockTtlSeconds = 5, onStatus = null } = {}) => {
  const cached = await get(key);
  if (cached !== null) {
    if (onStatus) onStatus('HIT');
    return cached;
  }

  if (inFlightRequests.has(key)) {
    const value = await inFlightRequests.get(key);
    if (onStatus) onStatus('MISS');
    return value;
  }

  const runPromise = (async () => {
    const redis = getClient();
    const lockKey = prefixKey(`lock:${key}`);
    const lockToken = crypto.randomUUID();
    let lockAcquired = false;

    if (redis && redis.status === 'ready') {
      try {
        const res = await redis.set(lockKey, lockToken, 'NX', 'EX', Math.max(1, lockTtlSeconds));
        lockAcquired = res === 'OK';
      } catch (err) {
        warnOnce(`Redis lock error for key '${key}'`, err);
      }
    }

    if (!lockAcquired && redis && redis.status === 'ready') {
      // Another instance may be populating the cache; wait briefly and re-check
      for (let attempt = 0; attempt < 3; attempt += 1) {
        await sleep(50);
        const populated = await get(key);
        if (populated !== null) {
          if (onStatus) onStatus('HIT');
          return populated;
        }
      }
    }

    const freshValue = await fetcher();
    if (freshValue !== undefined && freshValue !== null) {
      await set(key, freshValue, ttlSeconds);
    }

    if (lockAcquired && redis && redis.status === 'ready') {
      try {
        const currentLock = await redis.get(lockKey);
        if (currentLock === lockToken) {
          await redis.del(lockKey);
        }
      } catch {
        // Ignore lock cleanup errors
      }
    }

    if (onStatus) onStatus('MISS');
    return freshValue;
  })();

  inFlightRequests.set(key, runPromise);
  try {
    return await runPromise;
  } finally {
    inFlightRequests.delete(key);
  }
};

const zIncrBy = async (key, member, increment = 1, maxMembers = 200) => {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return false;
    const fullKey = prefixKey(key);
    await redis.zincrby(fullKey, increment, member);
    const count = await redis.zcard(fullKey);
    if (count > maxMembers) {
      // Trim lowest-scoring entries to bound sorted set memory
      await redis.zremrangebyrank(fullKey, 0, count - maxMembers - 1);
    }
    return true;
  } catch (err) {
    warnOnce(`Redis ZINCRBY failed for '${key}'`, err);
    return false;
  }
};

const zRevRangeWithScores = async (key, start = 0, stop = 9) => {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return [];
    const raw = await redis.zrevrange(prefixKey(key), start, stop, 'WITHSCORES');
    const items = [];
    for (let i = 0; i < raw.length; i += 2) {
      items.push({
        term: raw[i],
        count: Number(raw[i + 1]) || 0,
      });
    }
    return items;
  } catch (err) {
    warnOnce(`Redis ZREVRANGE failed for '${key}'`, err);
    return [];
  }
};

const setIfAbsent = async (key, value, ttlSeconds) => {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return true;
    const res = await redis.set(prefixKey(key), String(value), 'NX', 'EX', Math.max(1, ttlSeconds));
    return res === 'OK';
  } catch (err) {
    warnOnce(`Redis SET NX failed for '${key}'`, err);
    return false;
  }
};

const getVersion = async (key = 'products:version') => {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return '0';
    const raw = await redis.get(prefixKey(key));
    return raw || '1';
  } catch (err) {
    warnOnce(`Redis getVersion failed for '${key}'`, err);
    return '0';
  }
};

const bumpVersion = async (key = 'products:version') => {
  try {
    const redis = getClient();
    if (!redis || redis.status !== 'ready') return null;
    const next = await redis.incr(prefixKey(key));
    return String(next);
  } catch (err) {
    warnOnce(`Redis bumpVersion failed for '${key}'`, err);
    return null;
  }
};

const getHealthStatus = async () => {
  if (forceDisabled) {
    return { status: 'disconnected', latencyMs: 0, error: 'Redis client disabled' };
  }
  const start = Date.now();
  try {
    const redis = getClient();
    if (!redis) {
      return { status: 'disconnected', latencyMs: 0, error: 'Redis client not initialized' };
    }
    if (redis.status === 'wait') {
      await redis.connect();
    }
    const pong = await redis.ping();
    return {
      status: pong === 'PONG' ? 'connected' : 'disconnected',
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return {
      status: 'disconnected',
      latencyMs: Date.now() - start,
      error: err.message,
    };
  }
};

const disconnect = async () => {
  if (client) {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
    client = null;
  }
};

const setForceDisabled = (disabled) => {
  forceDisabled = Boolean(disabled);
};

module.exports = {
  prefixKey,
  namespacePrefix,
  getClient,
  isReady,
  get,
  set,
  del,
  delByPrefix,
  incr,
  getOrSet,
  zIncrBy,
  zRevRangeWithScores,
  setIfAbsent,
  getVersion,
  bumpVersion,
  getHealthStatus,
  disconnect,
  setForceDisabled,
};
