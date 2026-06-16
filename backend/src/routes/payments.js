const router = require('express').Router();
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

router.post('/place-order', authenticate, async (req, res) => {
  const { items, shipping_address, shipping = 0, notes } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'Cart is empty' });

  try {
    let subtotal = 0;
    let discount = 0;
    const orderItems = [];

    for (const item of items) {
      const productRes = await db.query(
        `SELECT p.*, (SELECT url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as primary_image
         FROM products p WHERE p.id = $1 AND p.is_active = TRUE`,
        [item.product_id]
      );
      const product = productRes.rows[0];
      if (!product) return res.status(400).json({ error: `Product not found: ${item.product_id}` });
      if (product.stock < item.quantity)
        return res.status(400).json({ error: `Insufficient stock for ${product.name}` });

      const now = new Date();
      let effectivePrice = parseFloat(product.price);
      let itemDiscount = 0;
      if (product.discount_active && product.discount_percent > 0) {
        const start = product.discount_start ? new Date(product.discount_start) : null;
        const end = product.discount_end ? new Date(product.discount_end) : null;
        if ((!start || now >= start) && (!end || now <= end)) {
          effectivePrice = effectivePrice * (1 - parseFloat(product.discount_percent) / 100);
          itemDiscount = (parseFloat(product.price) - effectivePrice) * item.quantity;
        }
      }

      const itemTotal = effectivePrice * item.quantity;
      subtotal += parseFloat(product.price) * item.quantity;
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
    }

    const tax = 0;
    const total = subtotal - discount + tax + parseFloat(shipping);

    const orderRes = await db.query(
      `INSERT INTO orders (user_id, subtotal, discount, tax, shipping, total, shipping_address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, subtotal, discount, tax, shipping, total, JSON.stringify(shipping_address), notes]
    );
    const order = orderRes.rows[0];

    for (const item of orderItems) {
      await db.query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_image, unit_price, quantity, discount, total)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [order.id, item.product_id, item.product_name, item.product_image, item.unit_price, item.quantity, item.discount, item.total]
      );
      await db.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.product_id]);
    }

    res.json({ order_id: order.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
