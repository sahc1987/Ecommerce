const router = require('express').Router();
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const safeErr = require('../utils/safeErr');

const MAX_LIMIT = 100;

router.use(authenticate, requireRole('admin'));

// GET all users
router.get('/', async (req, res) => {
  const { role, search, page = 1 } = req.query;
  const limit = Math.min(Number.parseInt(req.query.limit) || 20, MAX_LIMIT);
  const offset = (Number.parseInt(page) - 1) * limit;
  const conditions = [];
  const params = [];
  if (role) { params.push(role); conditions.push(`role = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  try {
    const countResult = await db.query(`SELECT COUNT(*) FROM users ${where}`, params.slice(0, -2));
    const result = await db.query(
      `SELECT id, name, email, role, is_active, created_at,
        (SELECT COUNT(*) FROM orders WHERE user_id = users.id) as order_count
       FROM users ${where} ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const total = Number.parseInt(countResult.rows[0].count);
    res.json({
      users: result.rows,
      total,
      page: Number.parseInt(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// GET single user
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, is_active, created_at FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// PUT update user
router.put('/:id', async (req, res) => {
  const { name, email, role, is_active, password } = req.body;
  try {
    const current = await db.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'User not found' });
    const u = current.rows[0];
    const hash = password ? await bcrypt.hash(password, 10) : u.password_hash;
    const result = await db.query(
      `UPDATE users SET name=$1, email=$2, role=$3, is_active=$4, password_hash=$5, updated_at=NOW()
       WHERE id=$6 RETURNING id, name, email, role, is_active, created_at`,
      [name ?? u.name, email ?? u.email, role ?? u.role, is_active ?? u.is_active, hash, req.params.id]
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// DELETE user (soft-delete)
router.delete('/:id', async (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: 'Cannot delete your own account' });
  try {
    await db.query('UPDATE users SET is_active=FALSE WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

module.exports = router;
