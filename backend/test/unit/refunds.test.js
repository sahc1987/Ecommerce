const { test } = require('node:test');
const assert = require('node:assert/strict');

// Card refunds need Stripe; these tests cover the rules around it, so make
// sure no real key is picked up.
delete process.env.STRIPE_SECRET_KEY;
const refunds = require('../../src/utils/refunds');

// Stands in for a pg client: applies the UPDATE to an in-memory order row.
function fakeClient(order) {
  const queries = [];
  return {
    queries,
    async query(sql, params) {
      queries.push(sql);
      const [refunded_amount, payment_status] = params;
      return { rows: [{ ...order, refunded_amount: String(refunded_amount), payment_status }] };
    },
  };
}

const cod = { id: 'o1', total: '100.00', refunded_amount: '0', payment_method: 'cod', payment_status: 'unpaid' };
const card = { ...cod, payment_method: 'stripe', payment_status: 'paid', stripe_payment_intent: 'pi_1' };

test('refundableLeft is the total minus what was already refunded', () => {
  assert.equal(refunds.refundableLeft(cod), 100);
  assert.equal(refunds.refundableLeft({ ...cod, refunded_amount: '25.10' }), 74.9);
});

test('hasCardPayment only for paid (or partly refunded) Stripe orders', () => {
  assert.equal(refunds.hasCardPayment(card), true);
  assert.equal(refunds.hasCardPayment({ ...card, payment_status: 'partially_refunded' }), true);
  assert.equal(refunds.hasCardPayment({ ...card, payment_status: 'unpaid' }), false);
  assert.equal(refunds.hasCardPayment(cod), false);
});

test('a cash refund is recorded without changing the payment status', async () => {
  const client = fakeClient(cod);
  const updated = await refunds.refundOrder(client, cod, 30, 'k');
  assert.equal(updated.refunded_amount, '30');
  assert.equal(updated.payment_status, 'unpaid');
});

test('refunds can never exceed what is left on the order', async () => {
  const partly = { ...cod, refunded_amount: '90' };
  await assert.rejects(refunds.refundOrder(fakeClient(partly), partly, 10.01, 'k'), (err) => {
    assert.ok(err instanceof refunds.RefundError);
    assert.equal(err.status, 400);
    assert.match(err.message, /At most 10\.00/);
    return true;
  });
});

test('zero, negative and non-numeric amounts are refused before touching the database', async () => {
  for (const amount of [0, -5, Number.NaN]) {
    const client = fakeClient(cod);
    await assert.rejects(refunds.refundOrder(client, cod, amount, 'k'), refunds.RefundError);
    assert.equal(client.queries.length, 0);
  }
});

test('a card refund fails (502) when Stripe is not configured, so the caller rolls back', async () => {
  await assert.rejects(refunds.refundOrder(fakeClient(card), card, 50, 'k'), (err) => {
    assert.equal(err.status, 502);
    assert.match(err.message, /Stripe/);
    return true;
  });
});
