const router = require('express').Router();
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

// GET returns
router.get('/', authenticate, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const isAdmin = ['admin', 'staff'].includes(req.user.role);

  let conditions = [];
  const params = [];
  if (!isAdmin) { params.push(req.user.id); conditions.push(`r.user_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`r.status = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(parseInt(limit), offset);

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM returns r ${where}`,
      params.slice(0, params.length - 2)
    );
    const result = await db.query(
      `SELECT r.*, u.name as customer_name, u.email as customer_email, o.total as order_total
       FROM returns r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN orders o ON r.order_id = o.id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      returns: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single return
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, u.name as customer_name, u.email as customer_email
       FROM returns r LEFT JOIN users u ON r.user_id = u.id WHERE r.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Return not found' });
    const ret = result.rows[0];
    if (!['admin', 'staff'].includes(req.user.role) && ret.user_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });
    const items = await db.query(
      `SELECT ri.*, oi.product_name, oi.unit_price, oi.product_image
       FROM return_items ri JOIN order_items oi ON ri.order_item_id = oi.id WHERE ri.return_id = $1`,
      [req.params.id]
    );
    res.json({ return: { ...ret, items: items.rows } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create return request
router.post('/', authenticate, async (req, res) => {
  const { order_id, reason, items } = req.body;
  if (!order_id || !reason) return res.status(400).json({ error: 'order_id and reason required' });
  try {
    const order = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [order_id, req.user.id]
    );
    if (!order.rows[0]) return res.status(404).json({ error: 'Order not found' });
    if (!['delivered', 'paid'].includes(order.rows[0].status))
      return res.status(400).json({ error: 'Order is not eligible for return' });

    const returnRes = await db.query(
      'INSERT INTO returns (order_id, user_id, reason) VALUES ($1,$2,$3) RETURNING *',
      [order_id, req.user.id, reason]
    );
    const ret = returnRes.rows[0];

    if (items?.length) {
      for (const item of items) {
        await db.query(
          'INSERT INTO return_items (return_id, order_item_id, quantity, reason) VALUES ($1,$2,$3,$4)',
          [ret.id, item.order_item_id, item.quantity, item.reason]
        );
      }
    }
    res.status(201).json({ return: ret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT process return (admin)
router.put('/:id', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  const { status, refund_amount, admin_notes } = req.body;
  const validStatuses = ['approved', 'rejected', 'refunded'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  try {
    const ret = await db.query('SELECT * FROM returns WHERE id = $1', [req.params.id]);
    if (!ret.rows[0]) return res.status(404).json({ error: 'Return not found' });

    const result = await db.query(
      `UPDATE returns SET status=$1, refund_amount=$2, admin_notes=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [status, refund_amount, admin_notes, req.params.id]
    );
    res.json({ return: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
