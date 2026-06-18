const router = require("express").Router();
const db = require("../config/database");
const { authenticate, requireRole } = require("../middleware/auth");
const { createNotification } = require("../utils/notifications");

// GET orders (admin: all, customer: own)
router.get("/", authenticate, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (Number.parseInt(page) - 1) * Number.parseInt(limit);
  const isAdmin = ["admin", "staff"].includes(req.user.role);

  let conditions = [];
  const params = [];
  if (!isAdmin) {
    params.push(req.user.id);
    conditions.push(`o.user_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`o.status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(Number.parseInt(limit), offset);

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM orders o ${where}`,
      params.slice(0, params.length - 2),
    );
    const result = await db.query(
      `SELECT o.*, u.name as customer_name, u.email as customer_email,
        (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) as item_count
       FROM orders o
       LEFT JOIN users u ON o.user_id = u.id
       ${where}
       ORDER BY o.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({
      orders: result.rows,
      total: Number.parseInt(countResult.rows[0].count),
      page: Number.parseInt(page),
      pages: Math.ceil(
        Number.parseInt(countResult.rows[0].count) / Number.parseInt(limit),
      ),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    if (!result.rows[0])
      return res.status(404).json({ error: "Order not found" });
    const order = result.rows[0];
    if (
      !["admin", "staff"].includes(req.user.role) &&
      order.user_id !== req.user.id
    )
      return res.status(403).json({ error: "Access denied" });
    const items = await db.query(
      "SELECT * FROM order_items WHERE order_id = $1",
      [req.params.id],
    );
    res.json({ order: { ...order, items: items.rows } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update order status (admin/staff only)
router.put(
  "/:id/status",
  authenticate,
  requireRole("admin", "staff"),
  async (req, res) => {
    const { status, tracking_number, carrier } = req.body;
    const validStatuses = [
      "pending",
      "paid",
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(status))
      return res.status(400).json({ error: "Invalid status" });
    try {
      const params = [status];
      let setClause = "status=$1, updated_at=NOW()";

      if (status === "shipped") {
        params.push(tracking_number || null, carrier || null);
        setClause += `, tracking_number=$${params.length - 1}, carrier=$${params.length}`;
      }

      params.push(req.params.id);
      const result = await db.query(
        `UPDATE orders SET ${setClause} WHERE id=$${params.length} RETURNING *`,
        params,
      );
      if (!result.rows[0])
        return res.status(404).json({ error: "Order not found" });

      const order = result.rows[0];
      if (order.user_id) {
        const orderShort = order.id.slice(0, 8).toUpperCase();
        const statusLabels = {
          pending: "pending review",
          paid: "paid",
          processing: "being processed",
          shipped: "shipped",
          delivered: "delivered",
          cancelled: "cancelled",
        };
        let message = `Your order #${orderShort} is now ${statusLabels[status] || status}.`;
        if (status === "shipped" && (order.carrier || order.tracking_number)) {
          const carrierPart = order.carrier ? `Carrier: ${order.carrier}.` : "";
          const trackingPart = order.tracking_number ? ` Tracking number: ${order.tracking_number}.` : "";
          message += ` ${carrierPart}${trackingPart}`;
        }
        await createNotification(
          order.user_id,
          "order_status",
          status === "shipped" ? "Your Order Has Shipped!" : "Order Status Updated",
          message,
          { order_id: order.id, status, tracking_number: order.tracking_number, carrier: order.carrier },
        );
      }

      res.json({ order });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

module.exports = router;
