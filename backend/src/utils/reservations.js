const db = require('../config/database');
const cache = require('./cache');

// How long an add-to-cart holds stock before it is released.
const HOLD_MINUTES = 3;
const HOLD_MS = HOLD_MINUTES * 60 * 1000;

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

// Cart token comes from the X-Cart-Token header (generated client-side).
const getCartToken = (req) => {
  const token = req.get('X-Cart-Token');
  return token && TOKEN_RE.test(token) ? token : null;
};

// SQL fragment: units held by *other* carts for a product (non-expired).
// $productId / $token are substituted by the caller's parameter positions.
const heldByOthersSql = (productParam, tokenParam) => {
  const excludeOwnCart = tokenParam ? 'AND r.cart_token <> ' + tokenParam : '';
  return `
  COALESCE((SELECT SUM(quantity) FROM stock_reservations r
            WHERE r.product_id = ${productParam}
              AND r.expires_at > NOW()
              ${excludeOwnCart}), 0)`;
};

// Available units for a cart: stock minus what other carts currently hold.
async function availableFor(client, productId, cartToken) {
  const res = await client.query(
    `SELECT p.stock - ${heldByOthersSql('$1', cartToken ? '$2' : null)} AS available
     FROM products p WHERE p.id = $1`,
    cartToken ? [productId, cartToken] : [productId]
  );
  return res.rows[0] ? Math.max(0, Number(res.rows[0].available)) : 0;
}

// Product list/detail caches include availability, so drop them on change.
async function invalidateProductCache(productIds) {
  await cache.invalidateProducts(...productIds);
}

// Replace the cart's holds with `items` (upsert each, remove the rest), renewing
// the timer. Returns one result per item with how much could be held.
async function syncReservations({ cartToken, userId, items }) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const wanted = new Map();
    for (const it of items) {
      const qty = Number.parseInt(it.quantity, 10);
      if (it.product_id && qty > 0) wanted.set(it.product_id, qty);
    }

    // Remove holds for products no longer in the cart.
    const keep = [...wanted.keys()];
    await client.query(
      `DELETE FROM stock_reservations WHERE cart_token = $1
       ${keep.length ? 'AND NOT (product_id = ANY($2::uuid[]))' : ''}`,
      keep.length ? [cartToken, keep] : [cartToken]
    );

    // Expiry is computed on the DB clock so it compares cleanly with NOW().
    const expiresAt = (await client.query("SELECT NOW() + ($1 || ' minutes')::interval AS t", [HOLD_MINUTES])).rows[0].t;
    const results = [];
    for (const [productId, qty] of wanted) {
      // Lock the product row so concurrent carts can't both grab the last unit.
      const prod = await client.query(
        'SELECT id, stock, is_active FROM products WHERE id = $1 FOR UPDATE',
        [productId]
      );
      if (!prod.rows[0]?.is_active) {
        results.push({ product_id: productId, requested: qty, reserved: 0, available: 0, expires_at: null });
        continue;
      }
      const available = await availableFor(client, productId, cartToken);
      const reserved = Math.min(qty, available);
      if (reserved > 0) {
        await client.query(
          `INSERT INTO stock_reservations (product_id, cart_token, user_id, quantity, expires_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (product_id, cart_token)
           DO UPDATE SET quantity = EXCLUDED.quantity, user_id = COALESCE(EXCLUDED.user_id, stock_reservations.user_id),
                         expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
          [productId, cartToken, userId, reserved, expiresAt]
        );
      } else {
        await client.query('DELETE FROM stock_reservations WHERE product_id = $1 AND cart_token = $2', [productId, cartToken]);
      }
      results.push({
        product_id: productId,
        requested: qty,
        reserved,
        available,
        expires_at: reserved > 0 ? expiresAt.toISOString() : null,
      });
    }
    await client.query('COMMIT');
    await invalidateProductCache(keep);
    return { items: results, expires_at: expiresAt.toISOString(), hold_minutes: HOLD_MINUTES };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// Push every non-expired hold of the cart forward by the full window.
async function renewReservations(cartToken) {
  const res = await db.query(
    `UPDATE stock_reservations SET expires_at = NOW() + ($2 || ' minutes')::interval, updated_at = NOW()
     WHERE cart_token = $1 AND expires_at > NOW()
     RETURNING product_id, quantity, expires_at`,
    [cartToken, HOLD_MINUTES]
  );
  const expiresAt = res.rows[0]?.expires_at ?? new Date(Date.now() + HOLD_MS);
  return { items: res.rows, expires_at: expiresAt.toISOString(), hold_minutes: HOLD_MINUTES };
}

async function getReservations(cartToken) {
  const res = await db.query(
    `SELECT product_id, quantity, expires_at FROM stock_reservations
     WHERE cart_token = $1 AND expires_at > NOW()`,
    [cartToken]
  );
  return { items: res.rows, hold_minutes: HOLD_MINUTES };
}

async function releaseReservations(cartToken, productId) {
  const res = await db.query(
    `DELETE FROM stock_reservations WHERE cart_token = $1 ${productId ? 'AND product_id = $2' : ''}
     RETURNING product_id`,
    productId ? [cartToken, productId] : [cartToken]
  );
  await invalidateProductCache(res.rows.map((r) => r.product_id));
}

// Expired rows are ignored by every query; this just keeps the table small.
function startExpiryJob(intervalMs = 60 * 1000) {
  const timer = setInterval(async () => {
    try {
      const res = await db.query(
        'DELETE FROM stock_reservations WHERE expires_at <= NOW() RETURNING product_id'
      );
      if (res.rowCount) await invalidateProductCache([...new Set(res.rows.map((r) => r.product_id))]);
    } catch {}
  }, intervalMs);
  timer.unref();
  return timer;
}

module.exports = {
  HOLD_MINUTES,
  getCartToken,
  heldByOthersSql,
  availableFor,
  syncReservations,
  renewReservations,
  getReservations,
  releaseReservations,
  invalidateProductCache,
  startExpiryJob,
};
