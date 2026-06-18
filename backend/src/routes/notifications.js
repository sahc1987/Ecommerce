const router = require("express").Router();
const db = require("../config/database");
const { authenticate } = require("../middleware/auth");

// GET notifications for current user
router.get("/", authenticate, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (Number.parseInt(page) - 1) * Number.parseInt(limit);
  try {
    const [countRes, unreadRes, listRes] = await Promise.all([
      db.query("SELECT COUNT(*) FROM notifications WHERE user_id = $1", [
        req.user.id,
      ]),
      db.query(
        "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE",
        [req.user.id],
      ),
      db.query(
        "SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
        [req.user.id, Number.parseInt(limit), offset],
      ),
    ]);
    res.json({
      notifications: listRes.rows,
      total: Number.parseInt(countRes.rows[0].count),
      unread: Number.parseInt(unreadRes.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /read-all - must be declared before /:id/read to avoid route conflict
router.put("/read-all", authenticate, async (req, res) => {
  try {
    await db.query(
      "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE",
      [req.user.id],
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id/read - mark one notification as read
router.put("/:id/read", authenticate, async (req, res) => {
  try {
    const result = await db.query(
      "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *",
      [req.params.id, req.user.id],
    );
    if (!result.rows[0])
      return res.status(404).json({ error: "Notification not found" });
    res.json({ notification: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - remove a notification
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const result = await db.query(
      "DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.user.id],
    );
    if (!result.rows[0])
      return res.status(404).json({ error: "Notification not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
