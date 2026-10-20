// The shared plumbing the routes rely on: transactions, paged lists and the
// response cache. Runs against fakes, no database or Redis needed.
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { stubModule, fakeClient, fakeRedis } = require('./fakes');

const client = fakeClient((sql) => (/COUNT/.test(sql) ? { rows: [{ count: '41' }] } : { rows: [{ id: 1 }] }));
stubModule('config/database', { connect: async () => client, query: client.query.bind(client) });
const redis = fakeRedis();
stubModule('config/redis', redis);

const { withTransaction } = require('../../src/utils/tx');
const { Filters, paginate } = require('../../src/utils/pagedQuery');
const cache = require('../../src/utils/cache');

const statements = () => client.calls.map((c) => c.sql);

describe('withTransaction', () => {
  test('commits and returns the result', async () => {
    client.calls.length = 0;
    const out = await withTransaction(async (c) => {
      await c.query('UPDATE x');
      return 'done';
    });
    assert.equal(out, 'done');
    assert.deepEqual(statements(), ['BEGIN', 'UPDATE x', 'COMMIT']);
  });

  test('rolls back, rethrows and always releases the client', async () => {
    client.calls.length = 0;
    const before = client.released;
    await assert.rejects(withTransaction(async (c) => {
      await c.query('UPDATE x');
      throw new Error('refused');
    }), /refused/);
    assert.deepEqual(statements(), ['BEGIN', 'UPDATE x', 'ROLLBACK']);
    assert.equal(client.released, before + 1);
  });
});

describe('Filters and paginate', () => {
  test('each value gets the next placeholder; a repeated ? reuses it', () => {
    const f = new Filters().add('a = ?', 1).raw('b IS TRUE').add('(c ILIKE ? OR d ILIKE ?)', '%x%');
    assert.equal(f.where, 'WHERE a = $1 AND b IS TRUE AND (c ILIKE $2 OR d ILIKE $2)');
    assert.deepEqual(f.params, [1, '%x%']);
    assert.equal(new Filters().where, '');
  });

  test('counts without the joins and pages with LIMIT/OFFSET after the filter values', async () => {
    client.calls.length = 0;
    const page = await paginate({
      select: 'o.*, u.name', table: 'orders o', joins: 'LEFT JOIN users u ON u.id = o.user_id',
      filters: new Filters().add('o.status = ?', 'paid'), orderBy: 'o.created_at DESC',
      page: 2, limit: 20, offset: 20,
    }, client);
    const [count, rows] = client.calls;
    assert.equal(count.sql, 'SELECT COUNT(*) FROM orders o WHERE o.status = $1');
    assert.deepEqual(count.params, ['paid']);
    assert.match(rows.sql, /FROM orders o LEFT JOIN users u .* WHERE o.status = \$1 ORDER BY o.created_at DESC LIMIT \$2 OFFSET \$3$/);
    assert.deepEqual(rows.params, ['paid', 20, 20]);
    assert.deepEqual(page, { rows: [{ id: 1 }], total: 41, page: 2, pages: 3 });
  });
});

describe('cache', () => {
  test('serves a hit until its namespace is invalidated', async () => {
    let loads = 0;
    const load = async () => ({ n: ++loads });
    assert.deepEqual(await cache.cached('products', 'list:a', 30, load), { n: 1 });
    assert.deepEqual(await cache.cached('products', 'list:a', 30, load), { n: 1 });
    await cache.invalidateProducts();
    assert.deepEqual(await cache.cached('products', 'list:a', 30, load), { n: 2 });
  });

  test('invalidating one namespace leaves the others cached', async () => {
    let loads = 0;
    const load = async () => ({ n: ++loads });
    await cache.cached('dashboard', 'summary:30', 60, load);
    await cache.invalidateProducts();
    assert.deepEqual(await cache.cached('dashboard', 'summary:30', 60, load), { n: 1 });
    await cache.invalidateCategories(); // also clears products, not the dashboard
    assert.deepEqual(await cache.cached('dashboard', 'summary:30', 60, load), { n: 1 });
  });

  test('a not-found (null) result is not cached', async () => {
    let loads = 0;
    const load = async () => (++loads === 1 ? null : { found: true });
    assert.equal(await cache.cached('products', 'detail:new-slug', 30, load), null);
    assert.deepEqual(await cache.cached('products', 'detail:new-slug', 30, load), { found: true });
  });

  test('with Redis down every read goes to the loader and nothing throws', async () => {
    redis.down = true;
    try {
      let loads = 0;
      const load = async () => ({ n: ++loads });
      await cache.cached('products', 'list:b', 30, load);
      assert.deepEqual(await cache.cached('products', 'list:b', 30, load), { n: 2 });
      await cache.invalidateProducts();
    } finally {
      redis.down = false;
    }
  });

  test('queryKey is independent of parameter order', () => {
    assert.equal(cache.queryKey({ sort: 'new', page: 2 }), cache.queryKey({ page: 2, sort: 'new' }));
  });
});
