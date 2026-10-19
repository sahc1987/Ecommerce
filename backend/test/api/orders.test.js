// Order lifecycle, cancellation, returns and refunds against the real API and
// database (cash-on-delivery orders; card refunds are covered by unit tests).
const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

describe('orders, returns and refunds', { skip: h.skip }, () => {
  let alice;
  let bob;
  let admin;
  let product;

  const place = async (quantity, buyer = alice) => {
    const r = await h.call(buyer.token, 'POST', '/payments/place-order', {
      items: [{ product_id: product.productId, variant_id: product.variantId, quantity }],
      shipping_address: { name: 'A', line1: '1 St', city: 'X', state: 'Y', zip: '1', country: 'US' },
      payment_method: 'cod',
    });
    assert.ok(r.status < 300, `place-order: ${r.status} ${JSON.stringify(r.data)}`);
    return r.data.order?.id ?? r.data.order_id;
  };
  const setStatus = (id, status, extra = {}) => h.call(admin.token, 'PUT', `/orders/${id}/status`, { status, ...extra });
  const deliver = async (id) => {
    await setStatus(id, 'paid');
    await setStatus(id, 'shipped', { tracking_number: 'TRK', carrier: 'UPS' });
    return setStatus(id, 'delivered');
  };
  const revenue = async () => Number((await h.call(admin.token, 'GET', '/dashboard/summary')).data.total_revenue);

  before(async () => {
    await h.start();
    alice = await h.register('alice');
    bob = await h.register('bob');
    admin = await h.register('admin', 'admin');
    product = await h.createProduct({ price: 25, stock: 50 });
  });
  after(h.stop);

  describe('customer cancellation', () => {
    let orderId;

    test('placing an order takes the stock', async () => {
      orderId = await place(2);
      assert.equal(await h.stockOf(product.variantId), 48);
    });

    test('the owner sees can_cancel; only staff see allowed_next', async () => {
      const own = await h.call(alice.token, 'GET', `/orders/${orderId}`);
      assert.equal(own.data.order.can_cancel, true);
      assert.deepEqual(own.data.order.allowed_next, []);
      const staff = await h.call(admin.token, 'GET', `/orders/${orderId}`);
      assert.deepEqual(staff.data.order.allowed_next, ['paid', 'cancelled']);
    });

    test("another customer can't see or cancel it", async () => {
      assert.equal((await h.call(bob.token, 'GET', `/orders/${orderId}`)).status, 403);
      assert.equal((await h.call(bob.token, 'POST', `/orders/${orderId}/cancel`)).status, 404);
    });

    test('cancelling puts the stock back, exactly once', async () => {
      const r = await h.call(alice.token, 'POST', `/orders/${orderId}/cancel`);
      assert.equal(r.status, 200);
      assert.equal(r.data.order.status, 'cancelled');
      assert.equal(await h.stockOf(product.variantId), 50);
      assert.equal((await h.call(alice.token, 'POST', `/orders/${orderId}/cancel`)).status, 409);
      assert.equal(await h.stockOf(product.variantId), 50);
    });

    test('customers cannot use the admin status endpoint', async () => {
      assert.equal((await h.call(alice.token, 'PUT', `/orders/${orderId}/status`, { status: 'paid' })).status, 403);
    });
  });

  describe('admin status changes', () => {
    let orderId;
    before(async () => {
      orderId = await place(3);
    });

    test('skipping steps is refused', async () => {
      assert.equal((await setStatus(orderId, 'shipped', { tracking_number: 'T' })).status, 409);
    });

    test('a stale expected_status gets 409 with the current order', async () => {
      const r = await setStatus(orderId, 'paid', { expected_status: 'processing' });
      assert.equal(r.status, 409);
      assert.equal(r.data.order.status, 'pending');
    });

    test('unknown statuses are rejected', async () => {
      assert.equal((await setStatus(orderId, 'bogus')).status, 400);
    });

    test('shipping requires a tracking number', async () => {
      assert.equal((await setStatus(orderId, 'paid', { expected_status: 'pending' })).status, 200);
      assert.equal((await setStatus(orderId, 'shipped', { tracking_number: '   ' })).status, 400);
    });

    test('once processing, only staff can cancel, and the stock comes back', async () => {
      assert.equal((await setStatus(orderId, 'processing')).status, 200);
      assert.equal((await h.call(alice.token, 'POST', `/orders/${orderId}/cancel`)).status, 409);
      assert.equal((await h.call(alice.token, 'GET', `/orders/${orderId}`)).data.order.can_cancel, false);
      const r = await setStatus(orderId, 'cancelled');
      assert.equal(r.status, 200);
      assert.equal(Number(r.data.order.refunded_amount), 0, 'cash orders record no refund on cancel');
      assert.equal(await h.stockOf(product.variantId), 50);
    });
  });

  describe('returns and refunds', () => {
    let orderId;
    let returnId;
    let revenueBefore;

    before(async () => {
      revenueBefore = await revenue();
      orderId = await place(4); // 4 × 25 = 100
    });

    test('only delivered orders can be returned', async () => {
      assert.equal((await h.call(alice.token, 'POST', '/returns', { order_id: orderId, reason: 'early' })).status, 400);
      assert.equal((await deliver(orderId)).data.order.status, 'delivered');
      assert.equal((await setStatus(orderId, 'cancelled')).status, 409, 'delivered orders cannot be cancelled');
    });

    test('a return names lines of this order and no more units than bought', async () => {
      const items = (await h.call(alice.token, 'GET', `/orders/${orderId}`)).data.order.items;
      const tooMany = await h.call(alice.token, 'POST', '/returns', {
        order_id: orderId, reason: 'x', items: [{ order_item_id: items[0].id, quantity: 5 }],
      });
      assert.equal(tooMany.status, 400);
      assert.equal((await h.call(bob.token, 'POST', '/returns', { order_id: orderId, reason: 'x' })).status, 404);

      const r = await h.call(alice.token, 'POST', '/returns', {
        order_id: orderId, reason: 'broken', items: [{ order_item_id: items[0].id, quantity: 1, reason: 'cracked' }],
      });
      assert.equal(r.status, 201);
      returnId = r.data.return.id;
    });

    test('one return per order', async () => {
      assert.equal((await h.call(alice.token, 'POST', '/returns', { order_id: orderId, reason: 'again' })).status, 400);
    });

    test('customers cannot process returns', async () => {
      assert.equal((await h.call(alice.token, 'PUT', `/returns/${returnId}`, { status: 'approved' })).status, 403);
    });

    test('refunds are capped at the order total', async () => {
      const r = await h.call(admin.token, 'PUT', `/returns/${returnId}`, { status: 'refunded', refund_amount: 150 });
      assert.equal(r.status, 400);
      assert.match(r.data.error, /At most 100\.00/);
    });

    test('an amount set when approving is used for the refund; only returned units are restocked', async () => {
      const approved = await h.call(admin.token, 'PUT', `/returns/${returnId}`, { status: 'approved', refund_amount: 25 });
      assert.equal(Number(approved.data.return.refund_amount), 25);

      const before = await h.stockOf(product.variantId);
      const refunded = await h.call(admin.token, 'PUT', `/returns/${returnId}`, { status: 'refunded' });
      assert.equal(refunded.status, 200);
      assert.equal(Number(refunded.data.return.refund_amount), 25);
      assert.equal(refunded.data.return.restocked, true);
      assert.equal(await h.stockOf(product.variantId), before + 1);

      const order = (await h.call(admin.token, 'GET', `/orders/${orderId}`)).data.order;
      assert.equal(Number(order.refunded_amount), 25);
    });

    test('refunded returns are final', async () => {
      assert.equal((await h.call(admin.token, 'PUT', `/returns/${returnId}`, { status: 'refunded', refund_amount: 10 })).status, 409);
      assert.equal((await h.call(admin.token, 'PUT', `/returns/${returnId}`, { status: 'rejected' })).status, 409);
    });

    test('a refund can skip restocking (damaged items)', async () => {
      const other = await place(2); // 50
      await deliver(other);
      const ret = (await h.call(alice.token, 'POST', '/returns', { order_id: other, reason: 'damaged' })).data.return;
      const before = await h.stockOf(product.variantId);
      const r = await h.call(admin.token, 'PUT', `/returns/${ret.id}`, { status: 'refunded', refund_amount: 50, restock: false });
      assert.equal(r.status, 200);
      assert.equal(r.data.return.restocked, false);
      assert.equal(await h.stockOf(product.variantId), before);
    });

    test('dashboard revenue is net of refunds', async () => {
      assert.equal(Math.round(((await revenue()) - revenueBefore) * 100) / 100, 100 - 25 + 50 - 50);
    });

    test('simultaneous return requests create only one return', async () => {
      const id = await place(1);
      await deliver(id);
      const results = await Promise.all(
        [1, 2, 3].map(() => h.call(alice.token, 'POST', '/returns', { order_id: id, reason: 'race' }))
      );
      assert.deepEqual(results.map((r) => r.status).sort(), [201, 400, 400]);
    });
  });
});
