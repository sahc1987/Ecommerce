const router = require('express').Router();
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const cache = require('../utils/cache');
const safeErr = require('../utils/safeErr');

const TTL = { list: 600, sub: 600 }; // 10 minutes

const slugify = (str) =>
  str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// GET all categories with subcategory counts
router.get('/', async (req, res) => {
  const cached = await cache.get('categories:list');
  if (cached) return res.json(cached);

  try {
    const result = await db.query(`
      SELECT c.*,
        (SELECT COUNT(*) FROM subcategories s WHERE s.category_id = c.id) AS subcategory_count,
        (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id) AS product_count
      FROM categories c ORDER BY c.name
    `);
    const data = { categories: result.rows };
    await cache.set('categories:list', data, TTL.list);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// GET subcategories for a category
router.get('/:id/subcategories', async (req, res) => {
  const cacheKey = `categories:sub:${req.params.id}`;
  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  try {
    const result = await db.query(
      'SELECT * FROM subcategories WHERE category_id = $1 ORDER BY name',
      [req.params.id]
    );
    const data = { subcategories: result.rows };
    await cache.set(cacheKey, data, TTL.sub);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// POST create category
router.post('/', authenticate, requireRole('admin', 'staff'), upload.single('image'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const slug = slugify(name);
  const image_url = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    const result = await db.query(
      'INSERT INTO categories (name, slug, description, image_url) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, slug, description, image_url]
    );
    await cache.del('categories:list');
    res.status(201).json({ category: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Category already exists' });
    res.status(500).json({ error: safeErr(err) });
  }
});

// PUT update category
router.put('/:id', authenticate, requireRole('admin', 'staff'), upload.single('image'), async (req, res) => {
  const { name, description, is_active } = req.body;
  try {
    const current = await db.query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Category not found' });
    const image_url = req.file ? `/uploads/${req.file.filename}` : current.rows[0].image_url;
    const result = await db.query(
      `UPDATE categories SET name=$1, slug=$2, description=$3, image_url=$4, is_active=$5 WHERE id=$6 RETURNING *`,
      [
        name || current.rows[0].name,
        slugify(name || current.rows[0].name),
        description ?? current.rows[0].description,
        image_url,
        is_active === undefined ? current.rows[0].is_active : is_active,
        req.params.id,
      ]
    );
    await cache.del('categories:list');
    res.json({ category: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// DELETE category
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    await db.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    await cache.del('categories:list');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// POST create subcategory
router.post('/:categoryId/subcategories', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const slug = slugify(name);
  try {
    const result = await db.query(
      'INSERT INTO subcategories (category_id, name, slug, description) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.categoryId, name, slug, description]
    );
    await Promise.all([
      cache.del('categories:list'),
      cache.del(`categories:sub:${req.params.categoryId}`),
    ]);
    res.status(201).json({ subcategory: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Subcategory already exists' });
    res.status(500).json({ error: safeErr(err) });
  }
});

// PUT update subcategory
router.put('/subcategories/:id', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  const { name, description, is_active } = req.body;
  try {
    const current = await db.query('SELECT * FROM subcategories WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Subcategory not found' });
    const result = await db.query(
      `UPDATE subcategories SET name=$1, slug=$2, description=$3, is_active=$4 WHERE id=$5 RETURNING *`,
      [
        name || current.rows[0].name,
        slugify(name || current.rows[0].name),
        description ?? current.rows[0].description,
        is_active === undefined ? current.rows[0].is_active : is_active,
        req.params.id,
      ]
    );
    await Promise.all([
      cache.del('categories:list'),
      cache.del(`categories:sub:${current.rows[0].category_id}`),
    ]);
    res.json({ subcategory: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// DELETE subcategory
router.delete('/subcategories/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const current = await db.query('SELECT category_id FROM subcategories WHERE id = $1', [req.params.id]);
    await db.query('DELETE FROM subcategories WHERE id = $1', [req.params.id]);
    await Promise.all([
      cache.del('categories:list'),
      cache.del(`categories:sub:${current.rows[0]?.category_id}`),
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

module.exports = router;
