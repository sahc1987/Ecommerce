// Malformed ids and paging values get a clean answer (404 / defaults), never a
// 500 from Postgres, and permissions still apply.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const BAD = 'not-a-uuid';

describe('request validation', { skip: h.skip }, () => {
  let customer;
  let admin;
  let product;

  before(async () => {
    await h.start();
    customer = await h.register('carol');
    admin = await h.register('dave', 'admin');
    product = await h.createProduct();
  });
  after(h.stop);

  test('list endpoints clamp page and limit', async () => {
    for (const url of [
      '/products?page=0&limit=-5',
      '/products/admin/all?page=0',
      '/users?page=0&limit=1000',
      '/orders?page=0',
      '/returns?page=0&limit=0',
      '/notifications?page=0&limit=0',
    ]) {
      const r = await h.call(admin.token, 'GET', url);
      assert.equal(r.status, 200, url);
    }
    assert.equal((await h.call(admin.token, 'GET', '/products?page=0')).data.page, 1);
  });

  test('malformed ids answer 404', async () => {
    const cases = [
      [customer, 'GET', `/orders/${BAD}`],
      [customer, 'POST', `/orders/${BAD}/cancel`],
      [admin, 'PUT', `/orders/${BAD}/status`, { status: 'paid' }],
      [customer, 'GET', `/returns/${BAD}`],
      [admin, 'PUT', `/returns/${BAD}`, { status: 'approved' }],
      [customer, 'POST', '/returns', { order_id: BAD, reason: 'x' }],
      [admin, 'GET', `/users/${BAD}`],
      [admin, 'PUT', `/users/${BAD}`, {}],
      [admin, 'DELETE', `/users/${BAD}`],
      [customer, 'PUT', `/notifications/${BAD}/read`],
      [customer, 'DELETE', `/notifications/${BAD}`],
      [customer, 'POST', `/payments/${BAD}/confirm`],
      [customer, 'POST', `/payments/${BAD}/cancel`],
      [admin, 'GET', `/products/admin/${BAD}`],
      [admin, 'PUT', `/products/${BAD}`, {}],
      [admin, 'DELETE', `/products/${BAD}`],
      [admin, 'PUT', `/products/${product.productId}/variants/${BAD}`, { stock: 1 }],
      [admin, 'DELETE', `/products/${product.productId}/images/${BAD}`],
      [null, 'GET', `/products/${'-'.repeat(36)}`],
    ];
    for (const [who, method, url, body] of cases) {
      const r = await h.call(who?.token, method, url, body);
      assert.equal(r.status, 404, `${method} ${url} → ${r.status}`);
    }
  });

  test('a malformed order_id filter is a 400', async () => {
    assert.equal((await h.call(customer.token, 'GET', `/returns?order_id=${BAD}`)).status, 400);
  });

  test('valid ids and slugs still work', async () => {
    const byId = await h.call(null, 'GET', `/products/${product.productId}`);
    assert.equal(byId.data.product.id, product.productId);
    const bySlug = await h.call(null, 'GET', `/products/${product.slug}`);
    assert.equal(bySlug.data.product.id, product.productId);
    assert.equal((await h.call(admin.token, 'GET', `/users/${customer.id}`)).status, 200);
    const edit = await h.call(admin.token, 'PUT', `/products/${product.productId}/variants/${product.variantId}`, { stock: 60 });
    assert.equal(edit.status, 200);
    assert.equal(await h.stockOf(product.variantId), 60);
  });

  test('permissions are unchanged', async () => {
    assert.equal((await h.call(customer.token, 'GET', `/users/${customer.id}`)).status, 403);
    assert.equal((await h.call(null, 'GET', '/orders')).status, 401);
  });
});
