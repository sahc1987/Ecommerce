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
      product_data: { name: item.product_name, images: stripeImages(item.product_image) },
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
  const result = await db.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  const order = result.rows[0];
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

function computeEffectivePrice(product) {
  if (!product.discount_active || product.discount_percent <= 0) {
    return Number.parseFloat(product.price);
  }
  const now = new Date();
  const start = product.discount_start ? new Date(product.discount_start) : null;
  const end = product.discount_end ? new Date(product.discount_end) : null;
  if ((!start || now >= start) && (!end || now <= end)) {
    return Number.parseFloat(product.price) * (1 - Number.parseFloat(product.discount_percent) / 100);
  }
  return Number.parseFloat(product.price);
}

function validateOrderRequest(items, paymentMethod) {
  if (!items?.length) return 'Cart is empty';
  if (!PAYMENT_METHODS.has(paymentMethod)) return 'Invalid payment method';
  if (paymentMethod === 'stripe' && !stripe) return 'Card payments are not available right now';
  return null;
}

async function fetchLockedProduct(client, productId) {
  const res = await client.query(
    `SELECT p.*, (SELECT url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as primary_image
     FROM products p WHERE p.id = $1 AND p.is_active = TRUE FOR UPDATE OF p`,
    [productId]
  );
  return res.rows[0] || null;
}

router.post('/place-order', authenticate, orderLimiter, idempotent, async (req, res) => {
  const { items, shipping_address, notes, payment_method = 'cod', client: clientApp } = req.body;
  const invalid = validateOrderRequest(items, payment_method);
  if (invalid) return res.status(400).json({ error: invalid });
  const cartToken = reservations.getCartToken(req);

  // Shipping is server-controlled — never trusted from the client
  const shipping = 0;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    let subtotal = 0;
    let discount = 0;
    const orderItems = [];
    const affectedProductIds = [];

    for (const item of items) {
      const product = await fetchLockedProduct(client, item.product_id);
      if (!product) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Product not found: ${item.product_id}` });
      }
      // Stock held by other carts is not for sale to this one; our own hold
      // (if any) is consumed by this order.
      const available = await reservations.availableFor(client, product.id, cartToken);
      if (available < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: available > 0
            ? `Only ${available} of ${product.name} available right now`
            : `${product.name} is out of stock`,
          product_id: product.id,
          available,
        });
      }

      const basePrice = Number.parseFloat(product.price);
      // Rounded to the cent so the stored total equals what Stripe charges.
      const effectivePrice = round2(computeEffectivePrice(product));
      const itemDiscount = (basePrice - effectivePrice) * item.quantity;

      subtotal += basePrice * item.quantity;
      discount += itemDiscount;
      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        product_image: product.primary_image,
        unit_price: effectivePrice,
        quantity: item.quantity,
        discount: itemDiscount,
        total: effectivePrice * item.quantity,
      });
      affectedProductIds.push({ id: product.id, slug: product.slug });
    }

    const settingsRes = await client.query('SELECT tax_rate, tax_enabled, currency FROM store_settings LIMIT 1');
    const settings = settingsRes.rows[0];
    const taxRate = settings?.tax_enabled ? Number.parseFloat(settings.tax_rate) || 0 : 0;
    const tax = taxRate > 0 ? Number.parseFloat(((subtotal - discount) * taxRate / 100).toFixed(2)) : 0;
    const total = subtotal - discount + tax + Number.parseFloat(shipping);

    const orderRes = await client.query(
      `INSERT INTO orders (user_id, subtotal, discount, tax, shipping, total, shipping_address, notes, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.id, subtotal, discount, tax, shipping, total, JSON.stringify(shipping_address), notes, payment_method]
    );
    const order = orderRes.rows[0];

    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_image, unit_price, quantity, discount, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [order.id, item.product_id, item.product_name, item.product_image, item.unit_price, item.quantity, item.discount, item.total]
      );
      await client.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
    }

    // The sale is final: release this cart's holds on the purchased products.
    if (cartToken) {
      await client.query('DELETE FROM stock_reservations WHERE cart_token = $1', [cartToken]);
    }

    // Card orders: open the Checkout session inside the transaction, so a Stripe
    // failure rolls the order back and the stock is never taken.
    const checkoutUrl = payment_method === 'stripe'
      ? await attachCheckoutSession(client, req, {
        order, orderItems, tax, currency: settings?.currency, clientApp,
      })
      : undefined;

    await client.query('COMMIT');

    await Promise.all([
      cache.invalidateProducts(...affectedProductIds.flatMap(({ id, slug }) => [id, slug])),
      cache.invalidateDashboard(),
    ]);

    // Card orders are announced once Stripe confirms payment (see stripeOrders.markPaid).
    if (payment_method === 'stripe') return res.json({ order_id: order.id, checkout_url: checkoutUrl });

    await stripeOrders.sendOrderNotifications(order, req.user.name);
    res.json({ order_id: order.id });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: safeErr(err) });
  } finally {
    client.release();
  }
});

module.exports = router;
