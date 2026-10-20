const db = require('../config/database');
const cache = require('./cache');
const variants = require('./variants');
const { withTransaction } = require('./tx');

// How long an add-to-cart holds stock before it is released.
const HOLD_MINUTES = 3;
const HOLD_MS = HOLD_MINUTES * 60 * 1000;

const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

// Cart token comes from the X-Cart-Token header (generated client-side).
const getCartToken = (req) => {
  const token = req.get('X-Cart-Token');
  return token && TOKEN_RE.test(token) ? token : null;
};

// SQL fragment: units held by *other* carts for a variant (non-expired).
// $variantId / $token are substituted by the caller's parameter positions.
const heldByOthersSql = (variantParam, tokenParam) => {
  const excludeOwnCart = tokenParam ? 'AND r.cart_token <> ' + tokenParam : '';
  return `
  COALESCE((SELECT SUM(quantity) FROM stock_reservations r
            WHERE r.variant_id = ${variantParam}
              AND r.expires_at > NOW()
              ${excludeOwnCart}), 0)`;
};

// Available units of a variant for a cart: stock minus what other carts hold.
async function availableFor(client, variantId, cartToken) {
  const res = await client.query(
    `SELECT v.stock - ${heldByOthersSql('$1', cartToken ? '$2' : null)} AS available
     FROM product_variants v WHERE v.id = $1`,
    cartToken ? [variantId, cartToken] : [variantId]
  );
  return res.rows[0] ? Math.max(0, Number(res.rows[0].available)) : 0;
}

// Replace the cart's holds with `items` (upsert each, remove the rest), renewing
// the timer. Items name a variant_id (or, from older clients, a product_id with
// a single variant). Returns one result per line with how much could be held;
// results carry product_id too so product-keyed carts keep working.
async function syncReservations({ cartToken, userId, items }) {
  const result = await withTransaction(async (client) => {
    const { lines, unresolved } = await variants.resolveLines(client, items);
    // Lock in a fixed order so two carts never wait on each other's rows.
    lines.sort((a, b) => a.variant_id.localeCompare(b.variant_id));

    // Remove holds for variants no longer in the cart.
    const keep = lines.map((l) => l.variant_id);
    await client.query(
      `DELETE FROM stock_reservations WHERE cart_token = $1
       ${keep.length ? 'AND NOT (variant_id = ANY($2::uuid[]))' : ''}`,
      keep.length ? [cartToken, keep] : [cartToken]
    );

    // Expiry is computed on the DB clock so it compares cleanly with NOW().
    const expiresAt = (await client.query("SELECT NOW() + ($1 || ' minutes')::interval AS t", [HOLD_MINUTES])).rows[0].t;
    const results = unresolved.map((u) => ({
      product_id: u.product_id, variant_id: null, requested: u.quantity, reserved: 0, available: 0,
      expires_at: null, error: 'variant_required',
    }));
    for (const { variant_id: variantId, quantity: qty } of lines) {
      // Lock the variant row so concurrent carts can't both grab the last unit.
      const row = (await client.query(
        `SELECT v.id, v.product_id, v.is_active AND p.is_active AS sellable
         FROM product_variants v JOIN products p ON p.id = v.product_id
         WHERE v.id = $1 FOR UPDATE OF v`,
        [variantId]
      )).rows[0];
      if (!row?.sellable) {
        results.push({ product_id: row?.product_id ?? null, variant_id: variantId, requested: qty, reserved: 0, available: 0, expires_at: null });
        continue;
      }
      const available = await availableFor(client, variantId, cartToken);
      const reserved = Math.min(qty, available);
      if (reserved > 0) {
        await client.query(
          `INSERT INTO stock_reservations (product_id, variant_id, cart_token, user_id, quantity, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (variant_id, cart_token)
           DO UPDATE SET quantity = EXCLUDED.quantity, user_id = COALESCE(EXCLUDED.user_id, stock_reservations.user_id),
                         expires_at = EXCLUDED.expires_at, updated_at = NOW()`,
          [row.product_id, variantId, cartToken, userId, reserved, expiresAt]
        );
      } else {
        await client.query('DELETE FROM stock_reservations WHERE variant_id = $1 AND cart_token = $2', [variantId, cartToken]);
      }
      results.push({
        product_id: row.product_id,
        variant_id: variantId,
        requested: qty,
        reserved,
        available,
        expires_at: reserved > 0 ? expiresAt.toISOString() : null,
      });
    }
    return { items: results, expires_at: expiresAt.toISOString(), hold_minutes: HOLD_MINUTES };
  });
  // Product lists and details show live availability.
  await cache.invalidateProducts();
  return result;
}

// Push every non-expired hold of the cart forward by the full window.
async function renewReservations(cartToken) {
  const res = await db.query(
    `UPDATE stock_reservations SET expires_at = NOW() + ($2 || ' minutes')::interval, updated_at = NOW()
     WHERE cart_token = $1 AND expires_at > NOW()
     RETURNING product_id, variant_id, quantity, expires_at`,
    [cartToken, HOLD_MINUTES]
  );
  const expiresAt = res.rows[0]?.expires_at ?? new Date(Date.now() + HOLD_MS);
  return { items: res.rows, expires_at: expiresAt.toISOString(), hold_minutes: HOLD_MINUTES };
}

async function getReservations(cartToken) {
  const res = await db.query(
    `SELECT product_id, variant_id, quantity, expires_at FROM stock_reservations
     WHERE cart_token = $1 AND expires_at > NOW()`,
    [cartToken]
  );
  return { items: res.rows, hold_minutes: HOLD_MINUTES };
}

// `id` may be a variant id, or a product id to release all of its variants.
async function releaseReservations(cartToken, id) {
  const res = await db.query(
    `DELETE FROM stock_reservations WHERE cart_token = $1 ${id ? 'AND (variant_id = $2 OR product_id = $2)' : ''}`,
    id ? [cartToken, id] : [cartToken]
  );
  if (res.rowCount) await cache.invalidateProducts();
}

// Expired rows are ignored by every query; this just keeps the table small.
function startExpiryJob(intervalMs = 60 * 1000) {
  const timer = setInterval(async () => {
    try {
      const res = await db.query('DELETE FROM stock_reservations WHERE expires_at <= NOW()');
      if (res.rowCount) await cache.invalidateProducts();
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
  startExpiryJob,
};
