const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const cache = require('../utils/cache');
const safeErr = require('../utils/safeErr');
const reservations = require('../utils/reservations');
const { idempotent } = require('../middleware/idempotency');
const stripe = require('../config/stripe');
const stripeOrders = require('../utils/stripeOrders');
const variants = require('../utils/variants');
const { withTransaction } = require('../utils/tx');
const { getStoreSettings } = require('../utils/storeSettings');
const { uuidParam } = require('../utils/validate');

router.param('id', uuidParam('Order not found'));

const PAYMENT_METHODS = new Set(['cod', 'stripe']);
const toCents = (amount) => Math.round(amount * 100);
const round2 = (amount) => Math.round(amount * 100) / 100;

// Where Stripe sends the customer afterwards. The web app handles both itself;
// the mobile app opens Checkout in the system browser, so it lands on a small
// page here telling the customer to switch back to the app.
function returnUrls(req, orderId, clientApp) {
  if (clientApp === 'mobile') {
    const base = `${req.protocol}://${req.get('host')}/api/payments/return`;
    return { success_url: `${base}?result=success`, cancel_url: `${base}?result=cancel` };
  }
  const web = process.env.CLIENT_URL || 'http://localhost:5173';
  return {
    success_url: `${web}/order-success?order=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${web}/checkout?canceled=${orderId}`,
  };
}

// Absolute http(s) URLs only — Stripe rejects relative paths like /uploads/x.png.
const stripeImages = (url) => (/^https?:\/\//.test(url || '') ? [url] : undefined);

async function createCheckoutSession(req, { order, orderItems, tax, currency, clientApp }) {
  const lineItems = orderItems.map((item) => ({
    quantity: item.quantity,
    price_data: {
      currency,
      unit_amount: toCents(item.unit_price),
      product_data: {
        name: item.variant_label ? `${item.product_name} (${item.variant_label})` : item.product_name,
        images: stripeImages(item.product_image),
      },
    },
  }));
  if (tax > 0) {
    lineItems.push({
      quantity: 1,
      price_data: { currency, unit_amount: toCents(tax), product_data: { name: 'Tax' } },
    });
  }
  return stripe.checkout.sessions.create(
    {
      mode: 'payment',
      line_items: lineItems,
      client_reference_id: order.id,
      customer_email: req.user.email,
      metadata: { order_id: order.id },
      payment_intent_data: { metadata: { order_id: order.id } },
      expires_at: Math.floor(Date.now() / 1000) + stripeOrders.SESSION_TTL_MINUTES * 60,
      ...returnUrls(req, order.id, clientApp),
    },
    { idempotencyKey: `checkout-${order.id}` }
  );
}

async function attachCheckoutSession(client, req, { currency, ...rest }) {
  const session = await createCheckoutSession(req, { ...rest, currency: (currency || 'USD').toLowerCase() });
  await client.query('UPDATE orders SET stripe_session_id = $1 WHERE id = $2', [session.id, rest.order.id]);
  return session.url;
}

// Lets clients show the card option only when Stripe is set up.
router.get('/config', (req, res) => {
  res.json({ stripe_enabled: Boolean(stripe) });
});

// Landing page for the mobile app's browser-based Checkout.
router.get('/return', (req, res) => {
  const paid = req.query.result === 'success';
  const title = paid ? 'Payment received' : 'Payment canceled';
  const body = paid
    ? 'Thanks! Your payment went through. Switch back to the app to see your order.'
    : 'No payment was taken. Switch back to the app to continue.';
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;text-align:center}
div{max-width:360px}h1{font-size:22px;margin:0 0 8px}p{color:#64748b;margin:0}</style></head>
<body><div><h1>${title}</h1><p>${body}</p></div></body></html>`);
});

async function findOwnOrder(req, res) {
  const order = (await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id])).rows[0];
  if (!order || order.user_id !== req.user.id) {
    res.status(404).json({ error: 'Order not found' });
    return null;
  }
  return order;
}

const paymentState = ({ id, status, payment_method, payment_status }) =>
  ({ order_id: id, status, payment_method, payment_status });

// Called when the customer comes back from Checkout: settles the order from
// Stripe's side without waiting for the webhook.
router.post('/:id/confirm', authenticate, async (req, res) => {
  try {
    const order = await findOwnOrder(req, res);
    if (!order) return;
    await stripeOrders.refreshOrder(order);
    const fresh = await db.query('SELECT * FROM orders WHERE id = $1', [order.id]);
    res.json(paymentState(fresh.rows[0]));
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// Customer backed out of Checkout: cancel the unpaid order and free its stock.
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const order = await findOwnOrder(req, res);
    if (!order) return;
    await stripeOrders.cancelCheckout(order);
    const fresh = await db.query('SELECT * FROM orders WHERE id = $1', [order.id]);
    res.json(paymentState(fresh.rows[0]));
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// Prevent authenticated users from flooding the order endpoint
const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many order attempts, please slow down.' },
});

const MAX_ORDER_LINES = 50;

function validateOrderRequest(items, paymentMethod) {
  const invalidLines = variants.validateLines(items, MAX_ORDER_LINES);
  if (invalidLines) return invalidLines;
  if (!PAYMENT_METHODS.has(paymentMethod)) return 'Invalid payment method';
  if (paymentMethod === 'stripe' && !stripe) return 'Card payments are not available right now';
  return null;
}

// The variant with what pricing needs from its product, locked for the order.
// Only sellable when both the variant and its product are active.
async function fetchLockedVariant(client, variantId) {
  const res = await client.query(
    `SELECT v.id, v.product_id, v.sku, v.price AS variant_price,
            p.name, p.slug, p.price, p.discount_percent, p.discount_active, p.discount_start, p.discount_end,
            (SELECT string_agg(v.options->>o.name, ' / ' ORDER BY o.position, o.id)
               FROM product_options o WHERE o.product_id = v.product_id) AS variant_label,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) AS primary_image
     FROM product_variants v JOIN products p ON p.id = v.product_id
     WHERE v.id = $1 AND v.is_active = TRUE AND p.is_active = TRUE
     FOR UPDATE OF v`,
    [variantId]
  );
  return res.rows[0] || null;
}

// The order can't go ahead; `body` is sent with `status`. Thrown inside the
// transaction so nothing it did is kept.
class OrderRejected extends Error {
  constructor(status, body) {
    super(body.error);
    this.status = status;
    this.body = body;
  }
}

// Locks, checks and prices every cart line inside the order's transaction.
// Throws OrderRejected when a line can't be sold.
async function priceOrderLines(client, items, cartToken) {
  // One line per variant (duplicates are summed, so they can't each pass the
  // stock check), locked in a fixed order to avoid deadlocks between orders.
  const { lines, unresolved } = await variants.resolveLines(client, items);
  if (unresolved.length) {
    throw new OrderRejected(400, {
      error: 'Please choose an option (size, color…) for every product in your cart',
      product_id: unresolved[0].product_id,
    });
  }
  lines.sort((a, b) => a.variant_id.localeCompare(b.variant_id));

  let subtotal = 0;
  let discount = 0;
  const orderItems = [];
  for (const line of lines) {
    const variant = await fetchLockedVariant(client, line.variant_id);
    if (!variant) {
      throw new OrderRejected(400, { error: 'A product in your cart is no longer available', variant_id: line.variant_id });
    }
    const displayName = variant.variant_label ? `${variant.name} (${variant.variant_label})` : variant.name;
    // Stock held by other carts is not for sale to this one; our own hold
    // (if any) is consumed by this order.
    const available = await reservations.availableFor(client, variant.id, cartToken);
    if (available < line.quantity) {
      throw new OrderRejected(409, {
        error: available > 0
          ? `Only ${available} of ${displayName} available right now`
          : `${displayName} is out of stock`,
        product_id: variant.product_id,
        variant_id: variant.id,
        available,
      });
    }

    const basePrice = Number.parseFloat(variant.variant_price ?? variant.price);
    // Rounded to the cent so the stored total equals what Stripe charges.
    const effectivePrice = round2(variants.effectivePrice(variant, variant.variant_price));
    const itemDiscount = (basePrice - effectivePrice) * line.quantity;

    subtotal += basePrice * line.quantity;
    discount += itemDiscount;
    orderItems.push({
      product_id: variant.product_id,
      variant_id: variant.id,
      sku: variant.sku,
      variant_label: variant.variant_label,
      product_name: variant.name,
      product_image: variant.primary_image,
      unit_price: effectivePrice,
      quantity: line.quantity,
      discount: itemDiscount,
      total: effectivePrice * line.quantity,
    });
  }
  return { orderItems, subtotal, discount };
}

// Creates the order, its lines and the stock deduction; for card orders also
// the Checkout session. Runs inside the caller's transaction.
async function createOrder(client, req, { items, shipping_address, notes, payment_method, clientApp, cartToken }) {
  // Shipping is server-controlled — never trusted from the client
  const shipping = 0;
  const { orderItems, subtotal, discount } = await priceOrderLines(client, items, cartToken);

  const settings = await getStoreSettings(client);
  const taxRate = settings.tax_enabled ? Number.parseFloat(settings.tax_rate) || 0 : 0;
  const tax = taxRate > 0 ? Number.parseFloat(((subtotal - discount) * taxRate / 100).toFixed(2)) : 0;
  const total = subtotal - discount + tax + shipping;

  const order = (await client.query(
    `INSERT INTO orders (user_id, subtotal, discount, tax, shipping, total, shipping_address, notes, payment_method)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.id, subtotal, discount, tax, shipping, total, JSON.stringify(shipping_address), notes, payment_method]
  )).rows[0];

  for (const item of orderItems) {
    await client.query(
      `INSERT INTO order_items
         (order_id, product_id, variant_id, sku, variant_label, product_name, product_image, unit_price, quantity, discount, total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        order.id, item.product_id, item.variant_id, item.sku, item.variant_label, item.product_name,
        item.product_image, item.unit_price, item.quantity, item.discount, item.total,
      ]
    );
    // CHECK (stock >= 0) on product_variants backs up the availability check.
    await client.query('UPDATE product_variants SET stock = stock - $1, updated_at = NOW() WHERE id = $2', [item.quantity, item.variant_id]);
  }

  // The sale is final: release this cart's holds on the purchased products.
  if (cartToken) {
    await client.query('DELETE FROM stock_reservations WHERE cart_token = $1', [cartToken]);
  }

  // Card orders: open the Checkout session inside the transaction, so a Stripe
  // failure rolls the order back and the stock is never taken.
  const checkoutUrl = payment_method === 'stripe'
    ? await attachCheckoutSession(client, req, { order, orderItems, tax, currency: settings.currency, clientApp })
    : undefined;
  return { order, checkoutUrl };
}

router.post('/place-order', authenticate, orderLimiter, idempotent, async (req, res) => {
  const { items, shipping_address, notes, payment_method = 'cod', client: clientApp } = req.body;
  const invalid = validateOrderRequest(items, payment_method);
  if (invalid) return res.status(400).json({ error: invalid });
  const cartToken = reservations.getCartToken(req);

  try {
    const { order, checkoutUrl } = await withTransaction((client) => createOrder(client, req, {
      items, shipping_address, notes, payment_method, clientApp, cartToken,
    }));
    await Promise.all([cache.invalidateProducts(), cache.invalidateDashboard()]);

    // Card orders are announced once Stripe confirms payment (see stripeOrders.markPaid).
    if (payment_method === 'stripe') return res.json({ order_id: order.id, checkout_url: checkoutUrl });

    await stripeOrders.sendOrderNotifications(order, req.user.name);
    res.json({ order_id: order.id });
  } catch (err) {
    if (err instanceof OrderRejected) return res.status(err.status).json(err.body);
    res.status(500).json({ error: safeErr(err) });
  }
});

module.exports = router;
