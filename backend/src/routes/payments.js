const router = require('express').Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const cache = require('../utils/cache');
const { createNotification, notifyAdmins } = require('../utils/notifications');

router.post('/place-order', authenticate, async (req, res) => {
  const { items, shipping_address, notes } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'Cart is empty' });

  // ponytail: shipping is server-controlled, never from the client (clients could send a negative
  // value to lower their total). No rate config exists yet, so it's flat 0 — compute it here when one does.
  const shipping = 0;

  // ponytail: one transaction with row locks so concurrent orders can't oversell.
  // SELECT ... FOR UPDATE OF p makes Postgres serialize buyers competing for the same product.
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    let subtotal = 0;
    let discount = 0;
    const orderItems = [];
    const affectedProductIds = [];

    for (const item of items) {
      const productRes = await client.query(
        `SELECT p.*, (SELECT url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as primary_image
         FROM products p WHERE p.id = $1 AND p.is_active = TRUE FOR UPDATE OF p`,
        [item.product_id]
      );
      const product = productRes.rows[0];
      if (!product) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Product not found: ${item.product_id}` }); }
      if (product.stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });
      }

      const now = new Date();
      let effectivePrice = Number.parseFloat(product.price);
      let itemDiscount = 0;
      if (product.discount_active && product.discount_percent > 0) {
        const start = product.discount_start ? new Date(product.discount_start) : null;
        const end = product.discount_end ? new Date(product.discount_end) : null;
        if ((!start || now >= start) && (!end || now <= end)) {
          effectivePrice = effectivePrice * (1 - Number.parseFloat(product.discount_percent) / 100);
          itemDiscount = (Number.parseFloat(product.price) - effectivePrice) * item.quantity;
        }
      }

      const itemTotal = effectivePrice * item.quantity;
      subtotal += Number.parseFloat(product.price) * item.quantity;
      discount += itemDiscount;
      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        product_image: product.primary_image,
        unit_price: effectivePrice,
        quantity: item.quantity,
        discount: itemDiscount,
        total: itemTotal,
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

    // Invalidate caches affected by the new order
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

    // Send notifications
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
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
