const router = require('express').Router();
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const cache = require('../utils/cache');

const TTL = { list: 300, detail: 300 }; // seconds

const slugify = (str) =>
  str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const getEffectivePrice = (product) => {
  if (!product.discount_active || !product.discount_percent) return product.price;
  const now = new Date();
  const start = product.discount_start ? new Date(product.discount_start) : null;
  const end = product.discount_end ? new Date(product.discount_end) : null;
  if (start && now < start) return product.price;
  if (end && now > end) return product.price;
  return parseFloat(product.price) * (1 - parseFloat(product.discount_percent) / 100);
};

// GET all products (public, with filters)
router.get('/', async (req, res) => {
  const { category, subcategory, search, discount, page = 1, limit = 20 } = req.query;
  const cacheKey = cache.queryKey('products:list', req.query);

  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  const offset = (parseInt(page) - 1) * parseInt(limit);
  let conditions = ['p.is_active = TRUE'];
  const params = [];

  if (category) { params.push(category); conditions.push(`p.category_id = $${params.length}`); }
  if (subcategory) { params.push(subcategory); conditions.push(`p.subcategory_id = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`); }
  if (discount === 'true') conditions.push('p.discount_active = TRUE');

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(parseInt(limit), offset);

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM products p ${where}`,
      params.slice(0, params.length - 2)
    );
    const result = await db.query(
      `SELECT p.*, c.name as category_name, s.name as subcategory_name,
        (SELECT url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as primary_image,
        (SELECT json_agg(pi ORDER BY pi.sort_order) FROM product_images pi WHERE pi.product_id = p.id) as images
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const data = {
      products: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
    };
    await cache.set(cacheKey, data, TTL.list);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all products for admin (includes inactive — not cached)
router.get('/admin/all', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  const { category, subcategory, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let conditions = [];
  const params = [];

  if (category) { params.push(category); conditions.push(`p.category_id = $${params.length}`); }
  if (subcategory) { params.push(subcategory); conditions.push(`p.subcategory_id = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`p.name ILIKE $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(parseInt(limit), offset);

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM products p ${where}`,
      params.slice(0, params.length - 2)
    );
    const result = await db.query(
      `SELECT p.*, c.name as category_name, s.name as subcategory_name,
        (SELECT url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as primary_image,
        (SELECT json_agg(pi ORDER BY pi.sort_order) FROM product_images pi WHERE pi.product_id = p.id) as images
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      products: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single product by id or slug
router.get('/:idOrSlug', async (req, res) => {
  const { idOrSlug } = req.params;
  const cacheKey = `products:detail:${idOrSlug}`;

  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  const isUUID = /^[0-9a-f-]{36}$/.test(idOrSlug);
  try {
    const result = await db.query(
      `SELECT p.*, c.name as category_name, s.name as subcategory_name,
        (SELECT json_agg(pi ORDER BY pi.sort_order) FROM product_images pi WHERE pi.product_id = p.id) as images
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       WHERE ${isUUID ? 'p.id' : 'p.slug'} = $1`,
      [idOrSlug]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
    const data = { product: result.rows[0] };
    await cache.set(cacheKey, data, TTL.detail);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create product
router.post('/', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  const {
    name, description, price, compare_at_price, discount_percent, discount_active,
    discount_start, discount_end, stock, sku, category_id, subcategory_id,
  } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Name and price required' });

  let slug = slugify(name);
  try {
    const existing = await db.query('SELECT id FROM products WHERE slug = $1', [slug]);
    if (existing.rows.length) slug = `${slug}-${Date.now()}`;

    const result = await db.query(
      `INSERT INTO products
        (name, slug, description, price, compare_at_price, discount_percent, discount_active,
         discount_start, discount_end, stock, sku, category_id, subcategory_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        name, slug, description, price, compare_at_price || null,
        discount_percent || 0, discount_active || false,
        discount_start || null, discount_end || null,
        stock || 0, sku || null, category_id || null, subcategory_id || null,
      ]
    );
    await cache.delByPattern('products:list:*');
    res.status(201).json({ product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update product
router.put('/:id', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  const {
    name, description, price, compare_at_price, discount_percent, discount_active,
    discount_start, discount_end, stock, sku, category_id, subcategory_id, is_active,
  } = req.body;
  try {
    const current = await db.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!current.rows[0]) return res.status(404).json({ error: 'Product not found' });
    const p = current.rows[0];
    const result = await db.query(
      `UPDATE products SET
        name=$1, slug=$2, description=$3, price=$4, compare_at_price=$5,
        discount_percent=$6, discount_active=$7, discount_start=$8, discount_end=$9,
        stock=$10, sku=$11, category_id=$12, subcategory_id=$13, is_active=$14,
        updated_at=NOW()
       WHERE id=$15 RETURNING *`,
      [
        name ?? p.name,
        name ? slugify(name) : p.slug,
        description ?? p.description,
        price ?? p.price,
        compare_at_price !== undefined ? compare_at_price : p.compare_at_price,
        discount_percent !== undefined ? discount_percent : p.discount_percent,
        discount_active !== undefined ? discount_active : p.discount_active,
        discount_start !== undefined ? discount_start : p.discount_start,
        discount_end !== undefined ? discount_end : p.discount_end,
        stock !== undefined ? stock : p.stock,
        sku !== undefined ? sku : p.sku,
        category_id !== undefined ? category_id : p.category_id,
        subcategory_id !== undefined ? subcategory_id : p.subcategory_id,
        is_active !== undefined ? is_active : p.is_active,
        req.params.id,
      ]
    );
    await Promise.all([
      cache.delByPattern('products:list:*'),
      cache.del(`products:detail:${req.params.id}`, `products:detail:${p.slug}`),
    ]);
    res.json({ product: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE product
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const current = await db.query('SELECT slug FROM products WHERE id = $1', [req.params.id]);
    await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    await Promise.all([
      cache.delByPattern('products:list:*'),
      cache.del(`products:detail:${req.params.id}`, `products:detail:${current.rows[0]?.slug}`),
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST upload product images
router.post('/:id/images', authenticate, requireRole('admin', 'staff'), upload.array('images', 10), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });
  try {
    const hasPrimary = await db.query(
      'SELECT id FROM product_images WHERE product_id = $1 AND is_primary = TRUE',
      [req.params.id]
    );
    const images = [];
    for (let i = 0; i < req.files.length; i++) {
      const isPrimary = hasPrimary.rows.length === 0 && i === 0;
      const result = await db.query(
        'INSERT INTO product_images (product_id, url, is_primary, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
        [req.params.id, `/uploads/${req.files[i].filename}`, isPrimary, i]
      );
      images.push(result.rows[0]);
    }
    await cache.del(`products:detail:${req.params.id}`);
    res.status(201).json({ images });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE product image
router.delete('/:id/images/:imageId', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const img = await db.query('SELECT * FROM product_images WHERE id=$1 AND product_id=$2', [
      req.params.imageId, req.params.id,
    ]);
    if (!img.rows[0]) return res.status(404).json({ error: 'Image not found' });
    await db.query('DELETE FROM product_images WHERE id=$1', [req.params.imageId]);
    if (img.rows[0].is_primary) {
      await db.query(
        `UPDATE product_images SET is_primary=TRUE WHERE id=(
          SELECT id FROM product_images WHERE product_id=$1 ORDER BY sort_order LIMIT 1)`,
        [req.params.id]
      );
    }
    await cache.del(`products:detail:${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT set primary image
router.put('/:id/images/:imageId/primary', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    await db.query('UPDATE product_images SET is_primary=FALSE WHERE product_id=$1', [req.params.id]);
    await db.query('UPDATE product_images SET is_primary=TRUE WHERE id=$1', [req.params.imageId]);
    await cache.del(`products:detail:${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
