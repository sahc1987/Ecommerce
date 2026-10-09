// Product variants: validation of admin input, pricing, and mapping cart lines
// to the variant they buy. See db/migrations/add_product_variants.sql.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QTY = 1000;
const MAX_OPTIONS = 3;
const MAX_VALUES = 50;
const MAX_VARIANTS = 100;

const cleanText = (v, max) => {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s && s.length <= max ? s : null;
};

// Blank SKUs mean "none"; SKUs are unique, so "" must never be stored.
const cleanSku = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 100) : null);

// Accepts numbers and numeric strings ("2"); rejects 0, negatives, fractions.
const isQuantity = (q) => {
  const n = typeof q === 'string' && q.trim() ? Number(q) : q;
  return Number.isInteger(n) && n >= 1 && n <= MAX_QTY;
};

// Validates { options, variants } from the admin. Returns { error } or
// { options, variants } normalized for insertion. With no options there must
// be exactly one variant, the default one ({}).
function parseVariantInput(rawOptions, rawVariants) {
  const optionsIn = rawOptions ?? [];
  if (!Array.isArray(optionsIn) || optionsIn.length > MAX_OPTIONS)
    return { error: `options must be an array of at most ${MAX_OPTIONS}` };

  const options = [];
  for (const o of optionsIn) {
    const name = cleanText(o?.name, 50);
    if (!name) return { error: 'Each option needs a name (max 50 characters)' };
    if (options.some((x) => x.name.toLowerCase() === name.toLowerCase()))
      return { error: `Duplicate option "${name}"` };
    if (!Array.isArray(o.values) || !o.values.length || o.values.length > MAX_VALUES)
      return { error: `Option "${name}" needs 1-${MAX_VALUES} values` };
    const values = [];
    for (const raw of o.values) {
      const value = cleanText(raw, 50);
      if (!value) return { error: `Option "${name}" has a blank or too long value` };
      if (values.includes(value)) return { error: `Option "${name}" lists "${value}" twice` };
      values.push(value);
    }
    options.push({ name, values });
  }

  if (!Array.isArray(rawVariants) || !rawVariants.length || rawVariants.length > MAX_VARIANTS)
    return { error: `variants must be an array of 1-${MAX_VARIANTS}` };
  if (!options.length && rawVariants.length !== 1)
    return { error: 'A product without options has exactly one variant' };

  const variants = [];
  const seenCombos = new Set();
  const seenSkus = new Set();
  for (const v of rawVariants) {
    const picked = v?.options ?? {};
    if (typeof picked !== 'object' || Array.isArray(picked)) return { error: 'Variant options must be an object' };
    if (Object.keys(picked).length !== options.length)
      return { error: 'Each variant must pick exactly one value per option' };
    const combo = {};
    for (const o of options) {
      if (!o.values.includes(picked[o.name]))
        return { error: `Variant has an invalid value for "${o.name}"` };
      combo[o.name] = picked[o.name];
    }
    const key = JSON.stringify(options.map((o) => combo[o.name]));
    if (seenCombos.has(key)) return { error: `Duplicate variant ${variantLabel(options, combo)}` };
    seenCombos.add(key);

    const sku = cleanSku(v.sku);
    if (sku) {
      if (seenSkus.has(sku)) return { error: `SKU "${sku}" is used twice` };
      seenSkus.add(sku);
    }

    const price = v.price === null || v.price === undefined || v.price === '' ? null : Number(v.price);
    if (price !== null && !(Number.isFinite(price) && price >= 0)) return { error: 'Variant price must be 0 or more' };
    const stock = v.stock === undefined || v.stock === '' ? 0 : Number(v.stock);
    if (!Number.isInteger(stock) || stock < 0) return { error: 'Variant stock must be a whole number, 0 or more' };

    variants.push({
      id: typeof v.id === 'string' && UUID_RE.test(v.id) ? v.id : null,
      sku,
      options: combo,
      price,
      stock,
      is_active: v.is_active === undefined ? true : Boolean(v.is_active),
    });
  }
  return { options, variants };
}

// "Rojo / M" in option order; null for the default variant.
function variantLabel(options, combo) {
  const parts = options.map((o) => combo?.[o.name]).filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
}

// Variant price (or the product's when it has none), with the product's
// discount applied while it is running.
function effectivePrice(product, variantPrice) {
  const base = Number.parseFloat(variantPrice ?? product.price);
  if (!product.discount_active || product.discount_percent <= 0) return base;
  const now = new Date();
  const start = product.discount_start ? new Date(product.discount_start) : null;
  const end = product.discount_end ? new Date(product.discount_end) : null;
  if ((!start || now >= start) && (!end || now <= end)) {
    return base * (1 - Number.parseFloat(product.discount_percent) / 100);
  }
  return base;
}

// Cart lines name a variant_id. Older clients only send product_id: that is
// accepted when the product has exactly one variant. Returns a Map of
// product_id → variant_id for those it could map.
async function defaultVariantIds(client, productIds) {
  const ids = [...new Set(productIds)];
  if (!ids.length) return new Map();
  const res = await client.query(
    `SELECT product_id, (array_agg(id))[1] AS variant_id
     FROM product_variants WHERE product_id = ANY($1::uuid[])
     GROUP BY product_id HAVING COUNT(*) = 1`,
    [ids]
  );
  return new Map(res.rows.map((r) => [r.product_id, r.variant_id]));
}

// Resolves each line to a variant_id (null when it can't be mapped) and merges
// lines for the same variant, summing their quantities.
async function resolveLines(client, items) {
  const legacy = items.filter((it) => !it.variant_id).map((it) => it.product_id);
  const defaults = await defaultVariantIds(client, legacy);
  const merged = new Map();
  const unresolved = [];
  for (const it of items) {
    const variantId = it.variant_id || defaults.get(it.product_id) || null;
    const quantity = Number(it.quantity);
    if (!variantId) {
      unresolved.push({ product_id: it.product_id, quantity });
      continue;
    }
    const prev = merged.get(variantId);
    merged.set(variantId, { variant_id: variantId, quantity: (prev?.quantity || 0) + quantity });
  }
  return { lines: [...merged.values()], unresolved };
}

// Request-shape check for cart lines: a UUID variant_id or product_id, and a
// whole quantity in range. Returns an error string or null.
function validateLines(items, maxItems) {
  if (!Array.isArray(items) || !items.length) return 'Cart is empty';
  if (items.length > maxItems) return `At most ${maxItems} cart lines`;
  for (const it of items) {
    const id = it?.variant_id ?? it?.product_id;
    if (!UUID_RE.test(String(id))) return 'Each item needs a valid variant_id or product_id';
    if (it.variant_id !== undefined && it.variant_id !== null && !UUID_RE.test(String(it.variant_id)))
      return 'Invalid variant_id';
    if (!isQuantity(it.quantity)) return `Each item needs a whole quantity between 1 and ${MAX_QTY}`;
  }
  return null;
}

module.exports = {
  UUID_RE,
  MAX_QTY,
  cleanSku,
  parseVariantInput,
  variantLabel,
  effectivePrice,
  resolveLines,
  validateLines,
};
