const router = require("express").Router();
const db = require("../config/database");
const { authenticate, requireStaff, isStaff } = require("../middleware/auth");
const { createNotification } = require("../utils/notifications");
const safeErr = require("../utils/safeErr");
const cache = require("../utils/cache");
const orderStatus = require("../utils/orderStatus");
const { OrderConflict, cancelOrder } = require("../utils/orderCancel");
const { RefundError } = require("../utils/refunds");
const { withTransaction } = require("../utils/tx");
const { Filters, paginate } = require("../utils/pagedQuery");
const { shortId } = require("../utils/format");
const { pagination, uuidParam } = require("../utils/validate");

router.param("id", uuidParam("Order not found"));

const STATUS_LABELS = {
  pending: "pending review",
  paid: "paid",
  processing: "being processed",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
};

function buildStatusMessage(order, status) {
  let message = `Your order #${shortId(order.id)} is now ${STATUS_LABELS[status] || status}.`;
  if (status === "shipped" && (order.carrier || order.tracking_number)) {
    const carrierPart = order.carrier ? `Carrier: ${order.carrier}.` : "";
    const trackingPart = order.tracking_number
      ? ` Tracking number: ${order.tracking_number}.`
      : "";
    message += ` ${carrierPart}${trackingPart}`;
  }
  return message;
}

// What the viewer may do next with the order: `allowed_next` lists the status
// changes an admin may make; `can_cancel` says whether the owner may cancel.
const withActions = (order, user) => ({
  ...order,
  allowed_next: isStaff(user) ? orderStatus.allowedNext(order) : [],
  can_cancel: order.user_id === user.id && orderStatus.canCustomerCancel(order),
});

// Status-change failures as responses: a refused change (409, with the fresh
// order) or a refund that couldn't be made (see RefundError.status). In every
// case nothing changed.
function sendChangeError(res, err, user) {
  if (err instanceof OrderConflict)
    return res.status(409).json({ error: err.message, order: withActions(err.order, user) });
  if (err instanceof RefundError) return res.status(err.status).json({ error: err.message });
  return res.status(500).json({ error: safeErr(err) });
}

// GET orders (admin: all, customer: own)
router.get("/", authenticate, async (req, res) => {
  const filters = new Filters();
  if (!isStaff(req.user)) filters.add("o.user_id = ?", req.user.id);
  if (req.query.status) filters.add("o.status = ?", req.query.status);

  try {
    const { rows, ...page } = await paginate({
      select: `o.*, u.name as customer_name, u.email as customer_email,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count`,
      table: "orders o",
      joins: "LEFT JOIN users u ON o.user_id = u.id",
      filters,
      orderBy: "o.created_at DESC",
      ...pagination(req.query),
    });
    res.json({ orders: rows, ...page });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// GET single order
router.get("/:id", authenticate, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT o.*, u.name as customer_name, u.email as customer_email
       FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = $1`,
      [req.params.id],
    );
    const order = result.rows[0];
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (!isStaff(req.user) && order.user_id !== req.user.id)
      return res.status(403).json({ error: "Access denied" });
    const items = await db.query(
      "SELECT * FROM order_items WHERE order_id = $1",
      [req.params.id],
    );
    res.json({ order: withActions({ ...order, items: items.rows }, req.user) });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

const trimmed = (v) => (typeof v === "string" ? v.trim() : "");

// Request body of PUT /:id/status → { status, expectedStatus, trackingNumber,
// carrier } or { error }.
function parseStatusChange({ status, expected_status, tracking_number, carrier }) {
  if (!orderStatus.STATUSES.includes(status)) return { error: "Invalid status" };
  if (expected_status != null && !orderStatus.STATUSES.includes(expected_status))
    return { error: "Invalid expected_status" };
  const trackingNumber = trimmed(tracking_number);
  if (status === "shipped" && !trackingNumber)
    return { error: "A tracking number is required to mark an order shipped" };
  return {
    status,
    expectedStatus: expected_status ?? null,
    trackingNumber,
    carrier: trimmed(carrier) || null,
  };
}

// Applies a non-cancel status change under a row lock. Returns the updated
// order, null when it doesn't exist, or throws OrderConflict.
function changeStatus(orderId, { status, expectedStatus, trackingNumber, carrier }) {
  return withTransaction(async (client) => {
    const current = (await client.query("SELECT * FROM orders WHERE id = $1 FOR UPDATE", [orderId])).rows[0];
    if (!current) return null;
    if (expectedStatus && current.status !== expectedStatus)
      throw new OrderConflict(`This order changed to ${current.status} while you were viewing it`, current);
    if (!orderStatus.canTransition(current, status))
      throw new OrderConflict(orderStatus.transitionError(current, status), current);

    const params = [status];
    let setClause = "status=$1, updated_at=NOW()";
    if (status === "shipped") {
      params.push(trackingNumber, carrier);
      setClause += `, tracking_number=$${params.length - 1}, carrier=$${params.length}`;
    }
    params.push(orderId);
    const result = await client.query(
      `UPDATE orders SET ${setClause} WHERE id=$${params.length} RETURNING *`,
      params,
    );
    return result.rows[0];
  });
}

async function notifyStatusChange(order, status) {
  if (!order.user_id) return;
  const title = status === "shipped" ? "Your Order Has Shipped!" : "Order Status Updated";
  await createNotification(
    order.user_id,
    "order_status",
    title,
    buildStatusMessage(order, status),
    { order_id: order.id, status, tracking_number: order.tracking_number, carrier: order.carrier },
  );
}

// PUT update order status (admin/staff only)
// Only the changes in utils/orderStatus.js are accepted. Send `expected_status`
// (the status you were looking at) to get a 409 instead of overwriting a change
// made meanwhile, e.g. Stripe marking the order paid. Cancelling restocks and
// refunds (utils/orderCancel.js).
router.put("/:id/status", authenticate, requireStaff, async (req, res) => {
  const change = parseStatusChange(req.body);
  if (change.error) return res.status(400).json({ error: change.error });
  const { status } = change;

  try {
    let order;
    if (status === "cancelled") {
      order = await cancelOrder(req.params.id, { expectedStatus: change.expectedStatus });
    } else {
      order = await changeStatus(req.params.id, change);
      if (order) {
        await cache.invalidateDashboard();
        await notifyStatusChange(order, status);
      }
    }
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ order: withActions(order, req.user) });
  } catch (err) {
    sendChangeError(res, err, req.user);
  }
});

// POST cancel your own order (customer), allowed until the store starts
// preparing it. Stock is released and a paid card order is refunded.
router.post("/:id/cancel", authenticate, async (req, res) => {
  try {
    const cancelled = await cancelOrder(req.params.id, { byCustomer: true, userId: req.user.id });
    if (!cancelled) return res.status(404).json({ error: "Order not found" });
    res.json({ order: withActions(cancelled, req.user) });
  } catch (err) {
    sendChangeError(res, err, req.user);
  }
});

module.exports = router;
