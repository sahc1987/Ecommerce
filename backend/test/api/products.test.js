// Product list ordering: newest first by default, and "Best sellers" ranked by
// units actually sold (cancelled orders don't count).
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('product list ordering', { skip: h.skip }, () => {
  let customer;
  let mouse;
  let cable;
  let lamp;

  const buy = async (product, quantity) => {
    const r = await h.call(customer.token, 'POST', '/payments/place-order', {
      items: [{ product_id: product.productId, variant_id: product.variantId, quantity }],
      shipping_address: { name: 'A', line1: '1 St', city: 'X', state: 'Y', zip: '1', country: 'US' },
      payment_method: 'cod',
    });
    assert.ok(r.status < 300, `place-order: ${r.status} ${JSON.stringify(r.data)}`);
    return r.data.order?.id ?? r.data.order_id;
  };

  const names = async (query) => {
    const r = await h.call(null, 'GET', `/products${query}`);
    assert.equal(r.status, 200);
    return r.data.products.map((p) => [p.id, p.units_sold]);
  };

  before(async () => {
    await h.start();
    customer = await h.register('erin');
    mouse = await h.createProduct();
    cable = await h.createProduct();
    lamp = await h.createProduct(); // newest

    await buy(cable, 3);
    await buy(mouse, 1);
    const cancelled = await buy(lamp, 5);
    assert.equal((await h.call(customer.token, 'POST', `/orders/${cancelled}/cancel`)).status, 200);
  });
  after(h.stop);

  test('newest first by default', async () => {
    const list = await names('');
    assert.deepEqual(list.map(([id]) => id), [lamp.productId, cable.productId, mouse.productId]);
  });

  test('sort=popular ranks by units sold, ignoring cancelled orders', async () => {
    const list = await names('?sort=popular');
    assert.deepEqual(list, [[cable.productId, 3], [mouse.productId, 1], [lamp.productId, 0]]);
  });

  test('an unknown sort falls back to newest first', async () => {
    const list = await names('?sort=price;DROP TABLE products');
    assert.equal(list[0][0], lamp.productId);
  });
});
