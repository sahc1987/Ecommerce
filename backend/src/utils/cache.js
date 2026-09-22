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

// ---- Invalidation helpers -------------------------------------------------
// Every write that changes what a cached read returns must call one of these,
// so clients always see the database after an update (the TTL is only a
// backstop). Keep the mapping here rather than in each route.

// Product lists embed price/stock/availability/primary image/category name, and
// details are cached under both id and slug, so clear everything product-shaped.
const invalidateProducts = async (...idsOrSlugs) => {
  await Promise.all([
    del(...idsOrSlugs.filter(Boolean).map((k) => `products:detail:${k}`)),
    delByPattern('products:detail:*'),
    delByPattern('products:list:*'),
  ]);
};

// Dashboard aggregates depend on orders, products, users and returns.
const invalidateDashboard = async () => {
  await Promise.all([
    del('dashboard:summary', 'dashboard:recent-orders', 'dashboard:top-products', 'dashboard:pending-shipments'),
    delByPattern('dashboard:sales-chart*'),
  ]);
};

const invalidateCategories = async (categoryId) => {
  await Promise.all([
    del('categories:list', ...(categoryId ? [`categories:sub:${categoryId}`] : [])),
    // product payloads embed category/subcategory names
    invalidateProducts(),
  ]);
};

module.exports = {
  get, set, del, delByPattern, queryKey,
  invalidateProducts, invalidateDashboard, invalidateCategories,
};
