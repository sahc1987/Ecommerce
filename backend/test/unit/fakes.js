// Replaces a module in Node's require cache, so code under test gets a fake
// (database pool, Redis client) without a real connection.
const path = require('node:path');

function stubModule(relativeToSrc, exports) {
  const file = require.resolve(path.join(__dirname, '../../src', relativeToSrc));
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}

// A client/pool whose query() records SQL and answers from `respond(sql, params)`.
function fakeClient(respond = () => ({ rows: [] })) {
  const calls = [];
  return {
    calls,
    released: 0,
    async query(sql, params) {
      calls.push({ sql: sql.replaceAll(/\s+/g, ' ').trim(), params });
      return respond(sql, params);
    },
    release() {
      this.released++;
    },
  };
}

// In-memory Redis with the commands utils/cache.js uses; `down` makes every call fail.
function fakeRedis() {
  const store = new Map();
  const r = {
    store,
    down: false,
    check() {
      if (r.down) throw new Error('Redis down');
    },
    async get(k) { r.check(); return store.has(k) ? store.get(k) : null; },
    async set(k, v) { r.check(); store.set(k, v); return 'OK'; },
    async incr(k) { r.check(); const n = Number(store.get(k) ?? 0) + 1; store.set(k, String(n)); return n; },
  };
  return r;
}

module.exports = { stubModule, fakeClient, fakeRedis };
