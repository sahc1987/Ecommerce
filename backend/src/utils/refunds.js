const stripe = require('../config/stripe');

const round2 = (n) => Math.round(n * 100) / 100;

// Thrown when money could not be returned; the caller rolls back so the order
// or return is left exactly as it was. `status` is the HTTP status to answer
// with: 400 for an amount that isn't allowed, 502 when Stripe refused.
class RefundError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// What can still be given back on an order.
const refundableLeft = (order) =>
  round2(Number.parseFloat(order.total) - Number.parseFloat(order.refunded_amount || 0));

// Card orders whose payment went through (fully or partly refunded already).
const hasCardPayment = (order) =>
  order.payment_method === 'stripe' && ['paid', 'partially_refunded'].includes(order.payment_status);

// Records `amount` as refunded on a locked order row: a Stripe refund for card
// payments (call this last before COMMIT), only the bookkeeping for cash on
// delivery. `key` makes a retried request reuse the same Stripe refund instead
// of refunding twice. Returns the updated order.
async function refundOrder(client, order, amount, key) {
  const value = round2(amount);
  if (!Number.isFinite(value) || value <= 0) throw new RefundError('Refund amount must be more than 0');
  if (value > refundableLeft(order))
    throw new RefundError(`At most ${refundableLeft(order).toFixed(2)} can still be refunded on this order`);

  const refunded = round2(Number.parseFloat(order.refunded_amount || 0) + value);
  const full = refunded >= round2(Number.parseFloat(order.total));
  let paymentStatus = order.payment_status;
  if (hasCardPayment(order)) paymentStatus = full ? 'refunded' : 'partially_refunded';

  const res = await client.query(
    'UPDATE orders SET refunded_amount = $1, payment_status = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
    [refunded, paymentStatus, order.id]
  );

  if (hasCardPayment(order)) {
    if (!stripe) throw new RefundError('Card refunds need Stripe to be configured on the server', 502);
    if (!order.stripe_payment_intent) throw new RefundError('No Stripe payment was found for this order', 502);
    try {
      await stripe.refunds.create(
        { payment_intent: order.stripe_payment_intent, amount: Math.round(value * 100) },
        { idempotencyKey: key }
      );
    } catch (err) {
      throw new RefundError(`Stripe refused the refund: ${err.message}`, 502);
    }
  }
  return res.rows[0];
}

module.exports = { RefundError, refundableLeft, hasCardPayment, refundOrder };
