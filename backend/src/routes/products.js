const router = require('express').Router();
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const cache = require('../utils/cache');
const safeErr = require('../utils/safeErr');
const slugify = require('../utils/slugify');
const variantsUtil = require('../utils/variants');
const { isUuid, pagination, uuidParam } = require('../utils/validate');

// Short TTLs: responses include live availability (stock minus active cart holds)
const TTL = { list: 30, detail: 30 }; // seconds

// Checked before the handlers (and before image uploads are received).
// `:idOrSlug` is not covered: a slug is a valid value there.
router.param('id', uuidParam('Product not found'));
router.param('variantId', uuidParam('Variant not found'));
router.param('imageId', uuidParam('Image not found'));

// SELECT columns for a product's options and variants (with live availability).
// The shop only sees active variants; the admin sees all of them.
const variantColumnsSql = (activeOnly) => `
  (SELECT COALESCE(json_agg(json_build_object('name', o.name, 'values', o."values") ORDER BY o.position, o.id), '[]'::json)
     FROM product_options o WHERE o.product_id = p.id) AS options,
  (SELECT COALESCE(json_agg(json_build_object(
       'id', v.id, 'sku', v.sku, 'options', v.options, 'price', v.price, 'stock', v.stock,
       'is_active', v.is_active, 'reserved_stock', h.held,
       'available_stock', GREATEST(v.stock - h.held, 0)
     ) ORDER BY v.position, v.created_at), '[]'::json)
     FROM product_variants v
     CROSS JOIN LATERAL (SELECT COALESCE(SUM(r.quantity), 0)::int AS held FROM stock_reservations r
                         WHERE r.variant_id = v.id AND r.expires_at > NOW()) h
     WHERE v.product_id = p.id ${activeOnly ? 'AND v.is_active = TRUE' : ''}) AS variants`;

// Product-level stock/sku/price range derived from the variants, so clients
// that predate variants keep reading `stock`, `available_stock` and `sku`.
function withVariantTotals(row) {
  const sellable = row.variants.filter((v) => v.is_active);
  const sum = (key) => sellable.reduce((n, v) => n + v[key], 0);
  const prices = sellable.map((v) => Number(v.price ?? row.price));
  const only = !row.options.length && row.variants.length === 1 ? row.variants[0] : null;
  return {
    ...row,
    stock: sum('stock'),
    reserved_stock: sum('reserved_stock'),
    available_stock: sum('available_stock'),
    sku: only ? only.sku : null,
    price_min: prices.length ? Math.min(...prices) : Number(row.price),
    price_max: prices.length ? Math.max(...prices) : Number(row.price),
  };
}

async function fetchProduct(client, id, { activeOnly = false } = {}) {
  const result = await client.query(
    `SELECT p.*, c.name as category_name, s.name as subcategory_name,
       (SELECT json_agg(pi ORDER BY pi.sort_order) FROM product_images pi WHERE pi.product_id = p.id) as images,
       ${variantColumnsSql(activeOnly)}
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     LEFT JOIN subcategories s ON p.subcategory_id = s.id
     WHERE p.id = $1`,
    [id]
  );
  return result.rows[0] ? withVariantTotals(result.rows[0]) : null;
}

// Replaces a product's options and variants with `parsed` (from
// parseVariantInput). Variants are matched by id: matched ones are updated in
// place (keeping their cart holds and order links), the rest are inserted, and
// variants left out are deleted.
async function saveVariants(client, productId, { options, variants }) {
  await client.query('DELETE FROM product_options WHERE product_id = $1', [productId]);
  for (const [position, o] of options.entries()) {
    await client.query(
      'INSERT INTO product_options (product_id, name, "values", position) VALUES ($1, $2, $3, $4)',
      [productId, o.name, o.values, position]
    );
  }

  const existing = await client.query('SELECT id FROM product_variants WHERE product_id = $1', [productId]);
  const existingIds = new Set(existing.rows.map((r) => r.id));
  const keepIds = variants.map((v) => v.id).filter((id) => existingIds.has(id));
  await client.query(
    'DELETE FROM product_variants WHERE product_id = $1 AND NOT (id = ANY($2::uuid[]))',
    [productId, keepIds]
  );
  // Park kept variants on placeholder values first, so two variants can swap
  // SKUs or option combinations without tripping the unique constraints.
  await client.query(
    `UPDATE product_variants SET sku = NULL, options = jsonb_build_object('_moving', id::text)
     WHERE id = ANY($1::uuid[])`,
    [keepIds]
  );
  for (const [position, v] of variants.entries()) {
    const values = [v.sku, JSON.stringify(v.options), v.price, v.stock, v.is_active, position];
    if (v.id && existingIds.has(v.id)) {
      await client.query(
        `UPDATE product_variants SET sku = $1, options = $2, price = $3, stock = $4, is_active = $5,
           position = $6, updated_at = NOW()
         WHERE id = $7`,
        [...values, v.id]
      );
    } else {
      await client.query(
        `INSERT INTO product_variants (sku, options, price, stock, is_active, position, product_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [...values, productId]
      );
    }
  }
}

// Unique violations an admin can fix, as a 409 message; null for anything else.
function conflictMessage(err) {
  if (err.code !== '23505') return null;
  if (err.constraint === 'product_variants_sku_key') return 'That SKU is already used by another variant';
  return 'That value is already in use';
}

// Order of the public list: `new` (default) or `popular` (most units sold in
// orders that weren't cancelled — the shop's "Best sellers").
const LIST_ORDER = {
  new: 'p.created_at DESC',
  popular: 'units_sold DESC, p.created_at DESC',
};

// GET all products (public, with filters)
router.get('/', async (req, res) => {
  const { category, subcategory, search, discount } = req.query;
  const orderBy = LIST_ORDER[req.query.sort] ?? LIST_ORDER.new;
  const { page, limit, offset } = pagination(req.query);
  const cacheKey = cache.queryKey('products:list', req.query);

  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  const conditions = ['p.is_active = TRUE'];
  const params = [];

  if (category) { params.push(category); conditions.push(`p.category_id = $${params.length}`); }
  if (subcategory) { params.push(subcategory); conditions.push(`p.subcategory_id = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`(p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`); }
  if (discount === 'true') conditions.push('p.discount_active = TRUE');

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM products p ${where}`,
      params.slice(0, -2)
    );
    const result = await db.query(
      `SELECT p.*, c.name as category_name, s.name as subcategory_name,
        (SELECT url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as primary_image,
        (SELECT json_agg(pi ORDER BY pi.sort_order) FROM product_images pi WHERE pi.product_id = p.id) as images,
        (SELECT COALESCE(SUM(oi.quantity), 0)::int FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
          WHERE oi.product_id = p.id AND o.status <> 'cancelled') as units_sold,
        ${variantColumnsSql(true)}
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       ${where}
       ORDER BY ${orderBy}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const total = Number.parseInt(countResult.rows[0].count);
    const data = {
      products: result.rows.map(withVariantTotals),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
    await cache.set(cacheKey, data, TTL.list);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// GET all products for admin (includes inactive — not cached)
router.get('/admin/all', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  const { category, subcategory, search } = req.query;
  const { page, limit, offset } = pagination(req.query);
  const conditions = [];
  const params = [];

  if (category) { params.push(category); conditions.push(`p.category_id = $${params.length}`); }
  if (subcategory) { params.push(subcategory); conditions.push(`p.subcategory_id = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`p.name ILIKE $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(limit, offset);

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM products p ${where}`,
      params.slice(0, -2)
    );
    const result = await db.query(
      `SELECT p.*, c.name as category_name, s.name as subcategory_name,
        (SELECT url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = TRUE LIMIT 1) as primary_image,
        (SELECT json_agg(pi ORDER BY pi.sort_order) FROM product_images pi WHERE pi.product_id = p.id) as images,
        ${variantColumnsSql(false)}
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const total = Number.parseInt(countResult.rows[0].count);
    res.json({
      products: result.rows.map(withVariantTotals),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// GET single product for the admin form: every variant, inactive ones included
// (saving the form replaces the variant list, so it must see all of them).
router.get('/admin/:id', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    const product = await fetchProduct(db, req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// GET single product by id or slug (shop view: active variants only)
router.get('/:idOrSlug', async (req, res) => {
  const { idOrSlug } = req.params;
  const cacheKey = `products:detail:${idOrSlug}`;

  const cached = await cache.get(cacheKey);
  if (cached) return res.json(cached);

  const isUUID = isUuid(idOrSlug);
  try {
    const result = await db.query(
      `SELECT p.*, c.name as category_name, s.name as subcategory_name,
        (SELECT json_agg(pi ORDER BY pi.sort_order) FROM product_images pi WHERE pi.product_id = p.id) as images,
        ${variantColumnsSql(true)}
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       LEFT JOIN subcategories s ON p.subcategory_id = s.id
       WHERE ${isUUID ? 'p.id' : 'p.slug'} = $1`,
      [idOrSlug]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
    const data = { product: withVariantTotals(result.rows[0]) };
    await cache.set(cacheKey, data, TTL.detail);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// Runs fn(client) in a transaction; rolls back and rethrows on error.
async function inTransaction(fn) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const sendWriteError = (res, err) => {
  const conflict = conflictMessage(err);
  if (conflict) return res.status(409).json({ error: conflict });
  res.status(500).json({ error: safeErr(err) });
};

// POST create product
// Body may carry `options` + `variants`; without them the product gets a
// single default variant from the top-level `stock` and `sku`.
router.post('/', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  const {
    name, description, price, compare_at_price, discount_percent, discount_active,
    discount_start, discount_end, stock, sku, category_id, subcategory_id, options, variants,
  } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Name and price required' });

  const parsed = variants === undefined
    ? variantsUtil.parseVariantInput([], [{ sku, stock: stock ?? 0 }])
    : variantsUtil.parseVariantInput(options, variants);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  let slug = slugify(name);
  try {
    const product = await inTransaction(async (client) => {
      const existing = await client.query('SELECT id FROM products WHERE slug = $1', [slug]);
      if (existing.rows.length) slug = `${slug}-${Date.now()}`;

      const result = await client.query(
        `INSERT INTO products
          (name, slug, description, price, compare_at_price, discount_percent, discount_active,
           discount_start, discount_end, category_id, subcategory_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
        [
          name, slug, description, price, compare_at_price || null,
          discount_percent || 0, discount_active || false,
          discount_start || null, discount_end || null,
          category_id || null, subcategory_id || null,
        ]
      );
      const id = result.rows[0].id;
      await saveVariants(client, id, parsed);
      return fetchProduct(client, id);
    });
    await Promise.all([cache.invalidateProducts(), cache.invalidateDashboard()]);
    res.status(201).json({ product });
  } catch (err) {
    sendWriteError(res, err);
  }
});

// Older clients send top-level `stock` / `sku`. They map onto the product's
// variant only when it has exactly one and no options. Returns an error or null.
async function applyLegacyStockSku(client, productId, { stock, sku }) {
  if (stock === undefined && sku === undefined) return null;
  const res = await client.query(
    `SELECT v.id, v.stock, v.sku FROM product_variants v
     WHERE v.product_id = $1
       AND NOT EXISTS (SELECT 1 FROM product_options o WHERE o.product_id = $1)
       AND (SELECT COUNT(*) FROM product_variants v2 WHERE v2.product_id = $1) = 1`,
    [productId]
  );
  const only = res.rows[0];
  if (!only) return 'This product has variants: set stock and SKU on each variant';
  const parsed = variantsUtil.parseVariantInput([], [{
    sku: sku === undefined ? only.sku : sku,
    stock: stock === undefined ? only.stock : stock,
  }]);
  if (parsed.error) return parsed.error;
  const [v] = parsed.variants;
  await client.query(
    'UPDATE product_variants SET stock = $1, sku = $2, updated_at = NOW() WHERE id = $3',
    [v.stock, v.sku, only.id]
  );
  return null;
}

class BadRequest extends Error {}

// PUT update product
// Sending `variants` (with `options`) replaces the whole variant list; see
// saveVariants for how existing variants are matched by id.
router.put('/:id', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  const {
    name, description, price, compare_at_price, discount_percent, discount_active,
    discount_start, discount_end, stock, sku, category_id, subcategory_id, is_active, options, variants,
  } = req.body;
  const parsed = variants === undefined ? null : variantsUtil.parseVariantInput(options, variants);
  if (parsed?.error) return res.status(400).json({ error: parsed.error });

  try {
    const outcome = await inTransaction(async (client) => {
      const current = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [req.params.id]);
      const p = current.rows[0];
      if (!p) return null;
      await client.query(
        `UPDATE products SET
          name=$1, slug=$2, description=$3, price=$4, compare_at_price=$5,
          discount_percent=$6, discount_active=$7, discount_start=$8, discount_end=$9,
          category_id=$10, subcategory_id=$11, is_active=$12,
          updated_at=NOW()
         WHERE id=$13`,
        [
          name ?? p.name,
          name ? slugify(name) : p.slug,
          description ?? p.description,
          price ?? p.price,
          compare_at_price === undefined ? p.compare_at_price : compare_at_price,
          discount_percent === undefined ? p.discount_percent : discount_percent,
          discount_active === undefined ? p.discount_active : discount_active,
          discount_start === undefined ? p.discount_start : discount_start,
          discount_end === undefined ? p.discount_end : discount_end,
          category_id === undefined ? p.category_id : category_id,
          subcategory_id === undefined ? p.subcategory_id : subcategory_id,
          is_active === undefined ? p.is_active : is_active,
          req.params.id,
        ]
      );
      if (parsed) {
        await saveVariants(client, p.id, parsed);
      } else {
        const legacyError = await applyLegacyStockSku(client, p.id, { stock, sku });
        if (legacyError) throw new BadRequest(legacyError);
      }
      return { oldSlug: p.slug, product: await fetchProduct(client, p.id) };
    });
    if (!outcome) return res.status(404).json({ error: 'Product not found' });
    await Promise.all([
      cache.invalidateProducts(req.params.id, outcome.oldSlug, outcome.product.slug),
      cache.invalidateDashboard(),
    ]);
    res.json({ product: outcome.product });
  } catch (err) {
    if (err instanceof BadRequest) return res.status(400).json({ error: err.message });
    sendWriteError(res, err);
  }
});

// PUT quick edit of one variant: any of sku, price (null = product price),
// stock, is_active.
router.put('/:id/variants/:variantId', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  const { sku, price, stock, is_active } = req.body;
  const sets = [];
  const params = [];
  const set = (column, value) => { params.push(value); sets.push(`${column} = $${params.length}`); };

  if (sku !== undefined) set('sku', variantsUtil.cleanSku(sku));
  if (price !== undefined) {
    const n = price === null || price === '' ? null : Number(price);
    if (n !== null && !(Number.isFinite(n) && n >= 0)) return res.status(400).json({ error: 'Price must be 0 or more' });
    set('price', n);
  }
  if (stock !== undefined) {
    const n = Number(stock);
    if (!Number.isInteger(n) || n < 0) return res.status(400).json({ error: 'Stock must be a whole number, 0 or more' });
    set('stock', n);
  }
  if (is_active !== undefined) set('is_active', Boolean(is_active));
  if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

  try {
    params.push(req.params.variantId, req.params.id);
    const result = await db.query(
      `UPDATE product_variants SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $${params.length - 1} AND product_id = $${params.length}
       RETURNING id`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Variant not found' });
    const product = await fetchProduct(db, req.params.id);
    await Promise.all([cache.invalidateProducts(req.params.id, product.slug), cache.invalidateDashboard()]);
    res.json({ product });
  } catch (err) {
    sendWriteError(res, err);
  }
});

// DELETE product
router.delete('/:id', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const current = await db.query('SELECT slug FROM products WHERE id = $1', [req.params.id]);
    await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    await Promise.all([cache.invalidateProducts(req.params.id, current.rows[0]?.slug), cache.invalidateDashboard()]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
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
        [req.params.id, req.files[i].url, isPrimary, i]
      );
      images.push(result.rows[0]);
    }
    await cache.invalidateProducts(req.params.id);
    res.status(201).json({ images });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
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
    await cache.invalidateProducts(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// PUT set primary image
router.put('/:id/images/:imageId/primary', authenticate, requireRole('admin', 'staff'), async (req, res) => {
  try {
    await db.query('UPDATE product_images SET is_primary=FALSE WHERE product_id=$1', [req.params.id]);
    await db.query('UPDATE product_images SET is_primary=TRUE WHERE id=$1', [req.params.imageId]);
    await cache.invalidateProducts(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

module.exports = router;
