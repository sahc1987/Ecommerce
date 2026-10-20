// Product list ordering: newest first by default, and "Best sellers" ranked by
// units sold. A sale is an order counted in revenue (paid, processing, shipped,
// delivered): pending and cancelled orders don't count, here or on the
// dashboard's top products.
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('product list ordering', { skip: h.skip }, () => {
  let customer;
  let admin;
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
  // Staff confirm a cash order as paid.
  const markPaid = async (orderId) =>
    assert.equal((await h.call(admin.token, 'PUT', `/orders/${orderId}/status`, { status: 'paid' })).status, 200);

  const names = async (query) => {
    const r = await h.call(null, 'GET', `/products${query}`);
    assert.equal(r.status, 200);
    return r.data.products.map((p) => [p.id, p.units_sold]);
  };

  before(async () => {
    await h.start();
    customer = await h.register('erin');
    admin = await h.register('gus', 'admin');
    mouse = await h.createProduct();
    cable = await h.createProduct();
    lamp = await h.createProduct(); // newest

    await markPaid(await buy(cable, 3));
    await markPaid(await buy(mouse, 1));
    await buy(mouse, 4); // still pending: not a sale yet
    const cancelled = await buy(lamp, 5);
    await markPaid(cancelled);
    assert.equal((await h.call(admin.token, 'PUT', `/orders/${cancelled}/status`, { status: 'cancelled' })).status, 200);
  });
  after(h.stop);

  test('newest first by default', async () => {
    const list = await names('');
    assert.deepEqual(list.map(([id]) => id), [lamp.productId, cable.productId, mouse.productId]);
  });

  test('sort=popular ranks by units sold, ignoring pending and cancelled orders', async () => {
    const list = await names('?sort=popular');
    assert.deepEqual(list, [[cable.productId, 3], [mouse.productId, 1], [lamp.productId, 0]]);
  });

  test("the dashboard's top products count the same sales", async () => {
    const r = await h.call(admin.token, 'GET', '/dashboard/top-products');
    assert.equal(r.status, 200);
    const units = Object.fromEntries(r.data.products.map((p) => [p.id, Number(p.units_sold)]));
    assert.equal(units[cable.productId], 3);
    assert.equal(units[mouse.productId], 1);
    assert.equal(units[lamp.productId], 0, 'a cancelled order is not a sale');
  });

  test('an unknown sort falls back to newest first', async () => {
    const list = await names('?sort=price;DROP TABLE products');
    assert.equal(list[0][0], lamp.productId);
  });
});
