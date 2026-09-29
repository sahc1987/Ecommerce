const db = require('../config/database');
const stripe = require('../config/stripe');
const cache = require('./cache');
const { createNotification, notifyAdmins } = require('./notifications');

// Checkout sessions live this long; Stripe's minimum is 30 minutes. Stock is
// deducted when the order is created, so an abandoned session holds it until
// then and is given back by cancelUnpaid().
const SESSION_TTL_MINUTES = 30;

async function sendOrderNotifications(order, customerName) {
  const orderShort = order.id.slice(0, 8).toUpperCase();
  const settings = await db.query('SELECT currency FROM store_settings LIMIT 1');
  const currency = settings.rows[0]?.currency || 'USD';
  const total = Number.parseFloat(order.total);
  const formattedTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(total);
  await Promise.all([
    createNotification(
      order.user_id,
      'new_order',
      'Order Confirmed',
      `Your order #${orderShort} for ${formattedTotal} has been placed successfully.`,
      { order_id: order.id, order_total: total }
    ),
    notifyAdmins(
      'new_order',
      'New Order Received',
      `${customerName} placed an order for ${formattedTotal}.`,
      { order_id: order.id, order_total: total, customer_name: customerName }
    ),
  ]);
}

// Idempotent: the webhook, the confirm endpoint and the sweeper may all see the
// same paid session; only the first one to flip payment_status does anything.
async function markPaid(orderId, paymentIntent) {
  const res = await db.query(
    `UPDATE orders
     SET payment_status = 'paid',
         status = CASE WHEN status = 'pending' THEN 'paid' ELSE status END,
         stripe_payment_intent = $2,
         updated_at = NOW()
     WHERE id = $1 AND payment_method = 'stripe' AND payment_status = 'unpaid'
     RETURNING *`,
    [orderId, paymentIntent || null]
  );
  const order = res.rows[0];
  if (!order) return false;

  await cache.invalidateDashboard();
  const user = await db.query('SELECT name FROM users WHERE id = $1', [order.user_id]);
  await sendOrderNotifications(order, user.rows[0]?.name || 'A customer');
  return true;
}

// Cancels an unpaid Stripe order and returns its units to stock. Idempotent.
async function cancelUnpaid(orderId) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `UPDATE orders SET status = 'cancelled', payment_status = 'canceled', updated_at = NOW()
       WHERE id = $1 AND payment_method = 'stripe' AND payment_status = 'unpaid' AND status = 'pending'
       RETURNING id`,
      [orderId]
    );
    if (!res.rows[0]) {
      await client.query('ROLLBACK');
      return false;
    }
    const restored = await client.query(
      `UPDATE products p SET stock = p.stock + oi.quantity
       FROM order_items oi
       WHERE oi.order_id = $1 AND p.id = oi.product_id
       RETURNING p.id, p.slug`,
      [orderId]
    );
    await client.query('COMMIT');

    await Promise.all([
      cache.invalidateProducts(...restored.rows.flatMap(({ id, slug }) => [id, slug])),
      cache.invalidateDashboard(),
    ]);
    return true;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Brings an order in line with its Checkout session's current state.
async function syncFromSession(orderId, session) {
  if (session.payment_status === 'paid' || session.payment_status === 'no_payment_required') {
    const pi = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    await markPaid(orderId, pi);
  } else if (session.status === 'expired') {
    await cancelUnpaid(orderId);
  }
}

// Looks the session up at Stripe. Used when the customer returns from Checkout,
// so orders settle even when webhooks are not reaching this server (local dev).
async function refreshOrder(order) {
  if (!stripe || order.payment_method !== 'stripe' || order.payment_status !== 'unpaid' || !order.stripe_session_id) {
    return;
  }
  const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
  await syncFromSession(order.id, session);
}

// Customer backed out of Checkout: expire the session so it can no longer be
// paid, then give the stock back. If it was paid in the meantime, keep it.
async function cancelCheckout(order) {
  if (order.payment_method !== 'stripe' || order.payment_status !== 'unpaid') return;
  if (stripe && order.stripe_session_id) {
    try {
      await stripe.checkout.sessions.expire(order.stripe_session_id);
    } catch {
      // Already completed or expired — let Stripe's view of it decide.
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      if (session.status !== 'open') return syncFromSession(order.id, session);
    }
  }
  await cancelUnpaid(order.id);
}

// Safety net for missed webhooks: settle Stripe orders whose session should
// have ended by now.
function startSweeper(intervalMs = 5 * 60 * 1000) {
  if (!stripe) return;
  const sweep = async () => {
    try {
      const stale = await db.query(
        `SELECT * FROM orders
         WHERE payment_method = 'stripe' AND payment_status = 'unpaid' AND status = 'pending'
           AND created_at < NOW() - INTERVAL '${SESSION_TTL_MINUTES + 5} minutes'
         LIMIT 50`
      );
      for (const order of stale.rows) {
        if (order.stripe_session_id) await refreshOrder(order);
        else await cancelUnpaid(order.id);
      }
    } catch (err) {
      console.error('Stripe sweeper error:', err.message);
    }
  };
  setInterval(sweep, intervalMs).unref();
}

module.exports = {
  SESSION_TTL_MINUTES,
  sendOrderNotifications,
  markPaid,
  cancelUnpaid,
  syncFromSession,
  refreshOrder,
  cancelCheckout,
  startSweeper,
};
