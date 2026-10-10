const db = require('../config/database');
const cache = require('./cache');
const stripeOrders = require('./stripeOrders');
const inventory = require('./inventory');
const orderStatus = require('./orderStatus');
const refunds = require('./refunds');
const { createNotification, notifyAdmins } = require('./notifications');

// Thrown when the order can't be cancelled from its current state; carries the
// fresh order so the apps can show it.
class OrderConflict extends Error {
  constructor(message, order) {
    super(message);
    this.order = order;
  }
}

const shortId = (id) => id.slice(0, 8).toUpperCase();

function checkCancellable(order, { byCustomer, expectedStatus }) {
  if (expectedStatus && order.status !== expectedStatus)
    throw new OrderConflict(`This order changed to ${order.status} while you were viewing it`, order);
  if (byCustomer && !orderStatus.canCustomerCancel(order))
    throw new OrderConflict('This order is already being prepared, so it can no longer be cancelled. Please contact the store.', order);
  if (!byCustomer && !orderStatus.canTransition(order, 'cancelled'))
    throw new OrderConflict(orderStatus.transitionError(order, 'cancelled'), order);
}

async function announce(order, { byCustomer, refunded }) {
  const orderShort = shortId(order.id);
  const refundText = refunded > 0 ? ` A refund of ${refunded.toFixed(2)} is on its way to your card.` : '';
  await Promise.all([
    order.user_id && createNotification(
      order.user_id,
      'order_status',
      'Order Cancelled',
      `Your order #${orderShort} has been cancelled.${refundText}`,
      { order_id: order.id, status: 'cancelled', refunded_amount: refunded }
    ),
    byCustomer && notifyAdmins(
      'order_cancelled',
      'Order Cancelled by Customer',
      `Order #${orderShort} was cancelled by the customer.${refunded > 0 ? ` ${refunded.toFixed(2)} refunded.` : ''}`,
      { order_id: order.id }
    ),
  ]);
}

// Cancels an order: its units go back to stock and, for a paid card order, the
// payment is refunded through Stripe — all or nothing (a failed refund leaves
// the order untouched). `byCustomer` applies the customer rule (only before
// preparation starts) and requires `userId` to own the order. Returns the
// cancelled order, or null when it doesn't exist (or isn't the customer's).
async function cancelOrder(orderId, { byCustomer = false, userId = null, expectedStatus = null } = {}) {
  const current = (await db.query('SELECT * FROM orders WHERE id = $1', [orderId])).rows[0];
  if (!current || (byCustomer && current.user_id !== userId)) return null;
  checkCancellable(current, { byCustomer, expectedStatus });

  // Unpaid card order: close its Checkout session first so it can't be paid
  // after cancelling. If it was paid in the meantime, it's cancelled below as
  // a paid order (with a refund) — that status change is ours, not a conflict.
  const closingCheckout = current.payment_method === 'stripe' && current.payment_status === 'unpaid';
  if (closingCheckout) {
    await stripeOrders.cancelCheckout(current);
    const after = (await db.query('SELECT * FROM orders WHERE id = $1', [orderId])).rows[0];
    if (after.status === 'cancelled') {
      await announce(after, { byCustomer, refunded: 0 });
      return after;
    }
  }

  const client = await db.connect();
  let cancelled;
  let touched = [];
  let refunded = 0;
  try {
    await client.query('BEGIN');
    const order = (await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId])).rows[0];
    checkCancellable(order, { byCustomer, expectedStatus: closingCheckout ? null : expectedStatus });
    cancelled = (await client.query(
      "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *",
      [orderId]
    )).rows[0];
    touched = await inventory.restockOrder(client, orderId);
    if (refunds.hasCardPayment(cancelled) && refunds.refundableLeft(cancelled) > 0) {
      refunded = refunds.refundableLeft(cancelled);
      // Stripe last: anything above failing rolls back before money moves.
      cancelled = await refunds.refundOrder(client, cancelled, refunded, `cancel-${orderId}`);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  await Promise.all([
    cache.invalidateProducts(...touched.flatMap(({ id, slug }) => [id, slug])),
    cache.invalidateDashboard(),
  ]);
  await announce(cancelled, { byCustomer, refunded });
  return cancelled;
}

module.exports = { OrderConflict, cancelOrder };
