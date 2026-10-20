const redis = require('../config/redis');

// Redis-backed response cache. Every call swallows Redis errors: with Redis
// down, reads simply go to the database, which is always authoritative.
//
// Keys live in namespaces ('products', 'dashboard', 'categories', 'setup').
// A key is `<namespace>:<generation>:<id>`, and invalidating a namespace bumps
// its generation with one INCR: older keys become unreachable and expire on
// their TTL. That keeps invalidation O(1); a SCAN over the keyspace would run
// on every cart change, since product payloads embed live availability.

const genKey = (ns) => `gen:${ns}`;

// Current generation of a namespace, or null when Redis is unavailable.
async function generation(ns) {
  try {
    return (await redis.get(genKey(ns))) ?? '0';
  } catch {
    return null;
  }
}

async function get(key) {
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch {
    return null;
  }
}

async function set(key, value, ttlSeconds) {
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // Redis unavailable: skip caching.
  }
}

// Deterministic id from query params, e.g. { page: 2, sort: 'new' } → "page=2&sort=new".
const queryKey = (query) =>
  Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

// Returns the cached value for `id` in namespace `ns`, or computes it with
// load(), caches it for `ttlSeconds` and returns it. A null result (not found)
// isn't cached. Errors from load() propagate.
async function cached(ns, id, ttlSeconds, load) {
  const gen = await generation(ns);
  const key = gen === null ? null : `${ns}:${gen}:${id}`;
  if (key) {
    const hit = await get(key);
    if (hit) return hit;
  }
  const value = await load();
  if (key && value != null) await set(key, value, ttlSeconds);
  return value;
}

async function invalidate(...namespaces) {
  try {
    await Promise.all(namespaces.map((ns) => redis.incr(genKey(ns))));
  } catch {
    // Redis unavailable: nothing is being served from it either.
  }
}

// ---- Invalidation helpers -------------------------------------------------
// Every write that changes what a cached read returns must call one of these,
// after COMMIT, so clients see the database right after an update (the TTL is
// only a backstop). Keep the mapping here rather than in each route.

// Product lists and details embed price, stock, availability, images and
// category names.
const invalidateProducts = () => invalidate('products');

// Dashboard aggregates depend on orders, products, users and returns.
const invalidateDashboard = () => invalidate('dashboard');

// Product payloads embed category/subcategory names too.
const invalidateCategories = () => invalidate('categories', 'products');

const invalidateSetup = () => invalidate('setup');

module.exports = {
  cached, queryKey, invalidate,
  invalidateProducts, invalidateDashboard, invalidateCategories, invalidateSetup,
};
