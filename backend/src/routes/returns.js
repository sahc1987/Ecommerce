const router = require('express').Router();
const db = require('../config/database');
const { authenticate, requireStaff, isStaff } = require('../middleware/auth');
const { createNotification, notifyAdmins } = require('../utils/notifications');
const safeErr = require('../utils/safeErr');
const cache = require('../utils/cache');
const inventory = require('../utils/inventory');
const refunds = require('../utils/refunds');
const { withTransaction } = require('../utils/tx');
const { Filters, paginate } = require('../utils/pagedQuery');
const { getStoreSettings, storeMoneyFormatter } = require('../utils/storeSettings');
const { shortId } = require('../utils/format');
const { isUuid, pagination, uuidParam } = require('../utils/validate');

router.param('id', uuidParam('Return not found'));

const MAX_RETURN_LINES = 100;

// Only lines that belong to this order may be returned, and never more
// units than were bought — otherwise a client could reference another
// customer's order_item_id or inflate the refund.
// Resolves to { lines } on success or { error } with a client-facing message.
async function validateReturnLines(orderId, items) {
  if (!items?.length) return { lines: [] };
  if (!Array.isArray(items) || items.length > MAX_RETURN_LINES) return { error: 'Invalid items' };

  const owned = await db.query(
    'SELECT id, quantity FROM order_items WHERE order_id = $1',
    [orderId]
  );
  const maxQty = new Map(owned.rows.map((r) => [r.id, r.quantity]));
  const lines = [];
  for (const item of items) {
    const qty = Number.parseInt(item?.quantity, 10);
    if (!maxQty.has(item?.order_item_id)) return { error: 'Item does not belong to this order' };
    if (!Number.isInteger(qty) || qty < 1 || qty > maxQty.get(item.order_item_id))
      return { error: 'Invalid return quantity' };
    lines.push({ order_item_id: item.order_item_id, quantity: qty, reason: item.reason ?? null });
  }
  return { lines };
}

// Saves a return with its lines, all or nothing. Returns null when the order
// already has a return (the unique index catches simultaneous requests).
async function insertReturn({ orderId, userId, reason, lines }) {
  try {
    return await withTransaction(async (client) => {
      const ret = (await client.query(
        'INSERT INTO returns (order_id, user_id, reason) VALUES ($1,$2,$3) RETURNING *',
        [orderId, userId, reason]
      )).rows[0];
      for (const line of lines) {
        await client.query(
          'INSERT INTO return_items (return_id, order_item_id, quantity, reason) VALUES ($1,$2,$3,$4)',
          [ret.id, line.order_item_id, line.quantity, line.reason]
        );
      }
      return ret;
    });
  } catch (err) {
    if (err.code === '23505' && err.constraint === 'idx_returns_one_per_order') return null;
    throw err;
  }
}

// `money` formats an amount in the store's currency (storeMoneyFormatter).
function buildReturnNotification(status, orderShort, refund_amount, admin_notes, money) {
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
  const formatted = refund_amount ? money(refund_amount) : 'your refund';
  return {
    title: 'Refund Processed',
    message: `${formatted} for order #${orderShort} has been processed.${note}`,
  };
}

// GET returns
router.get('/', authenticate, async (req, res) => {
  const { status, order_id } = req.query;
  if (order_id && !isUuid(order_id)) return res.status(400).json({ error: 'Invalid order_id' });

  const filters = new Filters();
  if (!isStaff(req.user)) filters.add('r.user_id = ?', req.user.id);
  if (status) filters.add('r.status = ?', status);
  if (order_id) filters.add('r.order_id = ?', order_id);

  try {
    const { rows, ...page } = await paginate({
      select: `r.*, u.name as customer_name, u.email as customer_email, o.total as order_total,
               o.refunded_amount as order_refunded_amount, o.payment_method as order_payment_method`,
      table: 'returns r',
      joins: 'LEFT JOIN users u ON r.user_id = u.id LEFT JOIN orders o ON r.order_id = o.id',
      filters,
      orderBy: 'r.created_at DESC',
      ...pagination(req.query),
    });
    res.json({ returns: rows, ...page });
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
    if (!isStaff(req.user) && ret.user_id !== req.user.id)
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
  if (!isUuid(order_id)) return res.status(404).json({ error: 'Order not found' });
  try {
    const order = await db.query(
      'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
      [order_id, req.user.id]
    );
    if (!order.rows[0]) return res.status(404).json({ error: 'Order not found' });
    // Before delivery the customer cancels instead (POST /orders/:id/cancel).
    if (order.rows[0].status !== 'delivered')
      return res.status(400).json({ error: 'Only delivered orders can be returned; cancel the order instead if it has not shipped' });

    const existingReturn = await db.query('SELECT id FROM returns WHERE order_id = $1', [order_id]);
    if (existingReturn.rows[0])
      return res.status(400).json({ error: 'A return request already exists for this order' });

    const windowDays = (await getStoreSettings()).return_window_days ?? 30;
    const orderDate = new Date(order.rows[0].created_at);
    const diffDays = Math.floor((Date.now() - orderDate.getTime()) / 86400000);
    if (diffDays > windowDays)
      return res.status(400).json({
        error: `Return window has expired. Returns must be requested within ${windowDays} days of the order date.`,
        expired: true,
      });

    const { lines, error: linesError } = await validateReturnLines(order_id, items);
    if (linesError) return res.status(400).json({ error: linesError });

    const ret = await insertReturn({ orderId: order_id, userId: req.user.id, reason, lines });
    if (!ret) return res.status(400).json({ error: 'A return request already exists for this order' });
    await cache.invalidateDashboard();

    const orderShort = shortId(order_id);
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

// requested → approved | rejected | refunded (approve and refund in one step),
// approved → refunded; rejected and refunded are final.
const RETURN_TRANSITIONS = {
  requested: ['approved', 'rejected', 'refunded'],
  approved: ['refunded'],
  rejected: [],
  refunded: [],
};

// A response to send instead of continuing; thrown inside the transaction.
class ReturnRejected extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// The amount to refund: the one sent, else the one saved when approving.
function refundAmountFor(ret, raw) {
  if (raw === undefined || raw === null || raw === '')
    return ret.refund_amount === null ? null : Number.parseFloat(ret.refund_amount);
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new ReturnRejected(400, 'Refund amount must be more than 0');
  return Math.round(n * 100) / 100;
}

// Units to put back: the returned lines, or the whole order when the request
// named no lines.
async function returnedUnits(client, ret) {
  const lines = await client.query(
    `SELECT oi.variant_id, ri.quantity FROM return_items ri
     JOIN order_items oi ON oi.id = ri.order_item_id WHERE ri.return_id = $1`,
    [ret.id]
  );
  if (lines.rows.length) return inventory.restock(client, lines.rows);
  return inventory.restockOrder(client, ret.order_id);
}

// Applies an admin decision to a return inside one transaction: validates the
// transition and amount, puts items back when asked, and refunds (Stripe for
// card orders) last, so a failed refund changes nothing.
function processReturn(returnId, { status, refundAmount, adminNotes, restock }) {
  return withTransaction(async (client) => {
    const ret = (await client.query('SELECT * FROM returns WHERE id = $1 FOR UPDATE', [returnId])).rows[0];
    if (!ret) throw new ReturnRejected(404, 'Return not found');
    if (!RETURN_TRANSITIONS[ret.status]?.includes(status))
      throw new ReturnRejected(409, `Can't change a ${ret.status} return to ${status}`);
    const order = (await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [ret.order_id])).rows[0];

    const amount = refundAmountFor(ret, refundAmount);
    if (amount !== null && amount > refunds.refundableLeft(order))
      throw new ReturnRejected(400, `At most ${refunds.refundableLeft(order).toFixed(2)} can still be refunded on this order`);
    if (status === 'refunded' && amount === null)
      throw new ReturnRejected(400, 'Enter the refund amount');

    const restocked = status === 'refunded' && restock !== false;
    if (restocked) await returnedUnits(client, ret);

    const updated = (await client.query(
      `UPDATE returns SET status=$1, refund_amount=$2, admin_notes=$3, restocked=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [status, amount, adminNotes ?? ret.admin_notes, restocked, returnId]
    )).rows[0];
    if (status === 'refunded') await refunds.refundOrder(client, order, amount, `return-${returnId}`);
    return { ret: updated, restocked };
  });
}

// PUT process return (admin)
// Body: status, refund_amount (required by the time it's refunded), admin_notes,
// restock (default true: returned units go back on sale when refunded).
router.put('/:id', authenticate, requireStaff, async (req, res) => {
  const { status, refund_amount, admin_notes, restock } = req.body;
  const validStatuses = ['approved', 'rejected', 'refunded'];
  if (!validStatuses.includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  try {
    const { ret, restocked } = await processReturn(req.params.id, {
      status, refundAmount: refund_amount, adminNotes: admin_notes, restock,
    });
    await Promise.all([
      cache.invalidateDashboard(),
      restocked && cache.invalidateProducts(),
    ]);

    if (ret.user_id) {
      // The saved amount: the refund may reuse the one set when approving.
      const amount = ret.refund_amount === null ? null : Number.parseFloat(ret.refund_amount);
      const { title, message } = buildReturnNotification(
        status, shortId(ret.order_id), amount, ret.admin_notes, await storeMoneyFormatter()
      );
      await createNotification(
        ret.user_id,
        'return_response',
        title,
        message,
        { return_id: ret.id, order_id: ret.order_id, status, refund_amount: amount }
      );
    }

    res.json({ return: ret });
  } catch (err) {
    if (err instanceof ReturnRejected || err instanceof refunds.RefundError)
      return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: safeErr(err) });
  }
});

module.exports = router;
