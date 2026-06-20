const router = require('express').Router();
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const { createNotification, notifyAdmins } = require('../utils/notifications');
const safeErr = require('../utils/safeErr');

const MAX_LIMIT = 100;

function buildReturnNotification(status, orderShort, refund_amount, admin_notes) {
  const note = admin_notes ? ` Note: ${admin_notes}` : '';
  const reason = admin_notes ? ` Reason: ${admin_notes}` : '';
  if (status === 'approved') {
    return {
      title: 'Return Approved',
      message: `Your return request for order #${orderShort} has been approved.${note}`,
    };
  }
  if (status === 'rejected') {
    return {
      title: 'Return Declined',
      message: `Your return request for order #${orderShort} was not approved.${reason}`,
    };
  }
  const formatted = refund_amount
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(refund_amount)
    : 'your refund';
  return {
    title: 'Refund Processed',
    message: `${formatted} for order #${orderShort} has been processed.${note}`,
  };
}

// GET returns
router.get('/', authenticate, async (req, res) => {
  const { status, order_id, page = 1 } = req.query;
  const limit = Math.min(Number.parseInt(req.query.limit) || 20, MAX_LIMIT);
  const offset = (Number.parseInt(page) - 1) * limit;
  const isAdmin = ['admin', 'staff'].includes(req.user.role);

  const conditions = [];
  const params = [];
  if (!isAdmin) { params.push(req.user.id); conditions.push(`r.user_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`r.status = $${params.length}`); }
  if (order_id) { params.push(order_id); conditions.push(`r.order_id = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM returns r ${where}`,
      params.slice(0, -2)
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
    const total = Number.parseInt(countResult.rows[0].count);
    res.json({
      returns: result.rows,
      total,
      page: Number.parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
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
    res.status(500).json({ error: safeErr(err) });
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

    const existingReturn = await db.query('SELECT id FROM returns WHERE order_id = $1', [order_id]);
    if (existingReturn.rows[0])
      return res.status(400).json({ error: 'A return request already exists for this order' });

    const settings = await db.query('SELECT return_window_days FROM store_settings LIMIT 1');
    const windowDays = settings.rows[0]?.return_window_days ?? 30;
    const orderDate = new Date(order.rows[0].created_at);
    const diffDays = Math.floor((Date.now() - orderDate.getTime()) / 86400000);
    if (diffDays > windowDays)
      return res.status(400).json({
        error: `Return window has expired. Returns must be requested within ${windowDays} days of the order date.`,
        expired: true,
      });

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

    const orderShort = order_id.slice(0, 8).toUpperCase();
    await Promise.all([
      createNotification(
        req.user.id,
        'return_request',
        'Return Request Submitted',
        `Your return request for order #${orderShort} has been received and is under review.`,
        { return_id: ret.id, order_id }
      ),
      notifyAdmins(
        'return_request',
        'New Return Request',
        `${req.user.name} requested a return for order #${orderShort}.`,
        { return_id: ret.id, order_id, customer_name: req.user.name }
      ),
    ]);

    res.status(201).json({ return: ret });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// PUT process return (admin)
router.put('/:id', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  const { status, refund_amount, admin_notes } = req.body;
  const validStatuses = ['approved', 'rejected', 'refunded'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  try {
    const existing = await db.query('SELECT * FROM returns WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Return not found' });

    const result = await db.query(
      `UPDATE returns SET status=$1, refund_amount=$2, admin_notes=$3, updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [status, refund_amount, admin_notes, req.params.id]
    );
    const ret = result.rows[0];

    if (ret.user_id) {
      const orderShort = ret.order_id.slice(0, 8).toUpperCase();
      const { title, message } = buildReturnNotification(status, orderShort, refund_amount, admin_notes);
      await createNotification(
        ret.user_id,
        'return_response',
        title,
        message,
        { return_id: ret.id, order_id: ret.order_id, status, refund_amount }
      );
    }

    res.json({ return: ret });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

module.exports = router;
