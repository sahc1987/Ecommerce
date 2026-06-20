const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const cache = require('../utils/cache');
const { createNotification, notifyAdmins } = require('../utils/notifications');
const safeErr = require('../utils/safeErr');

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

async function fetchLockedProduct(client, productId) {
  const res = await client.query(
    `SELECT p.*, (SELECT url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as primary_image
     FROM products p WHERE p.id = $1 AND p.is_active = TRUE FOR UPDATE OF p`,
    [productId]
  );
  return res.rows[0] || null;
}

router.post('/place-order', authenticate, orderLimiter, async (req, res) => {
  const { items, shipping_address, notes } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'Cart is empty' });

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
      if (product.stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }

      const basePrice = Number.parseFloat(product.price);
      const effectivePrice = computeEffectivePrice(product);
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
      `INSERT INTO orders (user_id, subtotal, discount, tax, shipping, total, shipping_address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, subtotal, discount, tax, shipping, total, JSON.stringify(shipping_address), notes]
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

    await client.query('COMMIT');

    const productCacheKeys = affectedProductIds.flatMap(({ id, slug }) => [
      `products:detail:${id}`,
      `products:detail:${slug}`,
    ]);
    await Promise.all([
      cache.del(...productCacheKeys),
      cache.delByPattern('products:list:*'),
      cache.del(
        'dashboard:summary',
        'dashboard:recent-orders',
        'dashboard:top-products',
        'dashboard:sales-chart',
        'dashboard:pending-shipments',
      ),
    ]);

    const orderShort = order.id.slice(0, 8).toUpperCase();
    const currency = settings?.currency || 'USD';
    const formattedTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(total);
    await Promise.all([
      createNotification(
        req.user.id,
        'new_order',
        'Order Confirmed',
        `Your order #${orderShort} for ${formattedTotal} has been placed successfully.`,
        { order_id: order.id, order_total: total }
      ),
      notifyAdmins(
        'new_order',
        'New Order Received',
        `${req.user.name} placed an order for ${formattedTotal}.`,
        { order_id: order.id, order_total: total, customer_name: req.user.name }
      ),
    ]);

    res.json({ order_id: order.id });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: safeErr(err) });
  } finally {
    client.release();
  }
});

module.exports = router;
