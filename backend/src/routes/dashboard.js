const router = require('express').Router();
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate, requireRole('admin', 'staff'));

// GET dashboard summary
router.get('/summary', async (req, res) => {
  try {
    const [revenue, orders, customers, products, pending, returns] = await Promise.all([
      db.query(`SELECT COALESCE(SUM(total),0) as total FROM orders WHERE status IN ('paid','processing','shipped','delivered')`),
      db.query(`SELECT COUNT(*) FROM orders`),
      db.query(`SELECT COUNT(*) FROM users WHERE role = 'customer'`),
      db.query(`SELECT COUNT(*) FROM products WHERE is_active = TRUE`),
      db.query(`SELECT COUNT(*) FROM orders WHERE status IN ('paid','processing')`),
      db.query(`SELECT COUNT(*) FROM returns WHERE status = 'requested'`),
    ]);

    res.json({
      total_revenue: parseFloat(revenue.rows[0].total),
      total_orders: parseInt(orders.rows[0].count),
      total_customers: parseInt(customers.rows[0].count),
      active_products: parseInt(products.rows[0].count),
      pending_shipments: parseInt(pending.rows[0].count),
      pending_returns: parseInt(returns.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET top selling products
router.get('/top-products', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        p.id, p.name, p.price,
        COALESCE(SUM(oi.quantity), 0) as units_sold,
        COALESCE(SUM(oi.total), 0) as revenue,
        (SELECT url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as image
      FROM products p
      LEFT JOIN order_items oi ON oi.product_id = p.id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.status IN ('paid','processing','shipped','delivered')
      GROUP BY p.id, p.name, p.price
      ORDER BY units_sold DESC, revenue DESC
      LIMIT 10
    `);
    res.json({ products: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET recent orders
router.get('/recent-orders', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT o.id, o.status, o.total, o.created_at, u.name as customer_name,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `);
    res.json({ orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET sales chart (last 30 days)
router.get('/sales-chart', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        DATE_TRUNC('day', created_at) as date,
        COUNT(*) as orders,
        COALESCE(SUM(total), 0) as revenue
      FROM orders
      WHERE status IN ('paid','processing','shipped','delivered')
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY date ASC
    `);
    res.json({ chart: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET pending shipments
router.get('/pending-shipments', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT o.*, u.name as customer_name, u.email as customer_email,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.status IN ('paid','processing')
      ORDER BY o.created_at ASC
      LIMIT 20
    `);
    res.json({ orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
