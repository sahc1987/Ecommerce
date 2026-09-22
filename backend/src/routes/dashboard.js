const router = require('express').Router();
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const cache = require('../utils/cache');
const safeErr = require('../utils/safeErr');

const TTL = { summary: 120, topProducts: 300, recentOrders: 60, salesChart: 300, pendingShipments: 60 };

router.use(authenticate, requireRole('admin', 'staff'));

// GET dashboard summary
router.get('/summary', async (req, res) => {
  const cached = await cache.get('dashboard:summary');
  if (cached) return res.json(cached);

  try {
    const [revenue, orders, customers, products, pending, returns] = await Promise.all([
      db.query(`SELECT COALESCE(SUM(total),0) as total FROM orders WHERE status IN ('paid','processing','shipped','delivered')`),
      db.query(`SELECT COUNT(*) FROM orders`),
      db.query(`SELECT COUNT(*) FROM users WHERE role = 'customer'`),
      db.query(`SELECT COUNT(*) FROM products WHERE is_active = TRUE`),
      db.query(`SELECT COUNT(*) FROM orders WHERE status IN ('paid','processing')`),
      db.query(`SELECT COUNT(*) FROM returns WHERE status = 'requested'`),
    ]);

    const data = {
      total_revenue: Number.parseFloat(revenue.rows[0].total),
      total_orders: Number.parseInt(orders.rows[0].count),
      total_customers: Number.parseInt(customers.rows[0].count),
      active_products: Number.parseInt(products.rows[0].count),
      pending_shipments: Number.parseInt(pending.rows[0].count),
      pending_returns: Number.parseInt(returns.rows[0].count),
    };
    await cache.set('dashboard:summary', data, TTL.summary);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// GET top selling products
router.get('/top-products', async (req, res) => {
  const cached = await cache.get('dashboard:top-products');
  if (cached) return res.json(cached);

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
    const data = { products: result.rows };
    await cache.set('dashboard:top-products', data, TTL.topProducts);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// GET recent orders
router.get('/recent-orders', async (req, res) => {
  const cached = await cache.get('dashboard:recent-orders');
  if (cached) return res.json(cached);

  try {
    const result = await db.query(`
      SELECT o.id, o.status, o.total, o.created_at, u.name as customer_name,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `);
    const data = { orders: result.rows };
    await cache.set('dashboard:recent-orders', data, TTL.recentOrders);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// GET sales chart (last 30 days)
// Query params: granularity=hour|day|week|month (default day),
// from/to = ISO dates (default: last 30 days). Buckets with no orders are
// filled with zeros so the chart has a continuous axis.
const GRANULARITIES = new Set(['hour', 'day', 'week', 'month']);
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

// The store's IANA zone: "today" and daily buckets follow it, not the server's.
async function storeTimeZone() {
  const r = await db.query('SELECT timezone FROM store_settings LIMIT 1');
  return r.rows[0]?.timezone || 'UTC';
}

// YYYY-MM-DD of "now" in the given zone.
const todayIn = (tz) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

router.get('/sales-chart', async (req, res) => {
  const granularity = GRANULARITIES.has(req.query.granularity) ? req.query.granularity : 'day';
  const tz = await storeTimeZone();
  const to = isIsoDate(req.query.to) ? req.query.to : todayIn(tz);
  let from = isIsoDate(req.query.from) ? req.query.from : null;
  if (!from) {
    const d = new Date(to);
    d.setUTCDate(d.getUTCDate() - 29);
    from = d.toISOString().slice(0, 10);
  }
  if (from > to) return res.status(400).json({ error: '"from" must be on or before "to"' });

  const cacheKey = cache.queryKey('dashboard:sales-chart', { granularity, from, to, tz });
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const result = await db.query(
      `WITH buckets AS (
         SELECT generate_series(
           DATE_TRUNC($1, $2::date),
           -- hourly buckets run through the last hour of the end day
           CASE WHEN $1 = 'hour' THEN $3::date + INTERVAL '23 hours' ELSE DATE_TRUNC($1, $3::date) END,
           ('1 ' || $1)::interval
         ) AS date
       ),
       sales AS (
         -- created_at is stored in UTC; shift to the store's zone before bucketing
         SELECT DATE_TRUNC($1, (created_at AT TIME ZONE 'UTC') AT TIME ZONE $4) AS date,
                COUNT(*) AS orders,
                COALESCE(SUM(total), 0) AS revenue
         FROM orders
         WHERE status IN ('paid','processing','shipped','delivered')
           AND created_at >= ($2::date::timestamp AT TIME ZONE $4) AT TIME ZONE 'UTC'
           AND created_at < (($3::date + INTERVAL '1 day')::timestamp AT TIME ZONE $4) AT TIME ZONE 'UTC'
         GROUP BY 1
       )
       SELECT to_char(b.date, CASE WHEN $1 = 'hour' THEN 'YYYY-MM-DD"T"HH24:00' ELSE 'YYYY-MM-DD' END) AS date,
              COALESCE(s.orders, 0) AS orders,
              COALESCE(s.revenue, 0) AS revenue
       FROM buckets b
       LEFT JOIN sales s ON s.date = b.date
       ORDER BY b.date ASC`,
      [granularity, from, to, tz]
    );
    const data = { chart: result.rows, granularity, from, to, timezone: tz };
    await cache.set(cacheKey, data, TTL.salesChart);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// GET pending shipments
router.get('/pending-shipments', async (req, res) => {
  const cached = await cache.get('dashboard:pending-shipments');
  if (cached) return res.json(cached);

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
    const data = { orders: result.rows };
    await cache.set('dashboard:pending-shipments', data, TTL.pendingShipments);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

module.exports = router;
