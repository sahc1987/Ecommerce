const { test } = require('node:test');
const assert = require('node:assert/strict');
const orderStatus = require('../../src/utils/orderStatus');

const order = (status, extra = {}) => ({ status, payment_method: 'cod', payment_status: 'unpaid', ...extra });

test('cash orders move pending → paid → processing → shipped → delivered', () => {
  assert.deepEqual(orderStatus.allowedNext(order('pending')), ['paid', 'cancelled']);
  assert.deepEqual(orderStatus.allowedNext(order('paid')), ['processing', 'shipped', 'cancelled']);
  assert.deepEqual(orderStatus.allowedNext(order('processing')), ['shipped', 'cancelled']);
  assert.deepEqual(orderStatus.allowedNext(order('shipped')), ['delivered']);
});

test('delivered and cancelled orders are final', () => {
  for (const status of ['delivered', 'cancelled']) {
    assert.deepEqual(orderStatus.allowedNext(order(status)), []);
    assert.match(orderStatus.transitionError(order(status), 'paid'), /can no longer change/);
  }
});

test('shipped orders cannot be cancelled (returns handle them)', () => {
  assert.equal(orderStatus.canTransition(order('shipped'), 'cancelled'), false);
});

test('an unpaid card order cannot be marked paid by hand', () => {
  const card = order('pending', { payment_method: 'stripe' });
  assert.deepEqual(orderStatus.allowedNext(card), ['cancelled']);
  assert.match(orderStatus.transitionError(card, 'paid'), /Stripe confirms/);
});

test('customers may cancel only before preparation starts', () => {
  assert.equal(orderStatus.canCustomerCancel(order('pending')), true);
  assert.equal(orderStatus.canCustomerCancel(order('paid')), true);
  for (const status of ['processing', 'shipped', 'delivered', 'cancelled'])
    assert.equal(orderStatus.canCustomerCancel(order(status)), false, status);
});

test('unknown statuses allow nothing', () => {
  assert.deepEqual(orderStatus.allowedNext(order('lost')), []);
});
