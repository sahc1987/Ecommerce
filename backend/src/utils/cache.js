const redis = require('../config/redis');

const get = async (key) => {
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
};

const set = async (key, value, ttlSeconds) => {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Redis unavailable — skip caching, DB is authoritative
  }
};

const del = async (...keys) => {
  try {
    if (keys.length) await redis.del(...keys);
  } catch {}
};

// Scans and deletes all keys matching a glob pattern (safe for production unlike KEYS)
const delByPattern = async (pattern) => {
  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  } catch {}
};

// Builds a deterministic cache key from express query params
const queryKey = (prefix, query) => {
  const parts = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return parts ? `${prefix}:${parts}` : prefix;
};

module.exports = { get, set, del, delByPattern, queryKey };
