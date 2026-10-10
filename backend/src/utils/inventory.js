// Putting sold units back on sale: cancelled orders and returned items.
// Callers run these inside their own transaction and invalidate caches after
// COMMIT with the returned products.

// Adds `lines` ([{ variant_id, quantity }]) back to stock, summed per variant
// (UPDATE … FROM applies only one matching row per variant). Lines whose
// variant was deleted are skipped. Returns [{ id, slug }] of the products touched.
async function restock(client, lines) {
  const totals = new Map();
  for (const { variant_id: variantId, quantity } of lines) {
    if (variantId && quantity > 0) totals.set(variantId, (totals.get(variantId) || 0) + quantity);
  }
  if (!totals.size) return [];
  const res = await client.query(
    `UPDATE product_variants v SET stock = v.stock + t.quantity, updated_at = NOW()
     FROM (SELECT * FROM unnest($1::uuid[], $2::int[]) AS t(variant_id, quantity)) t, products p
     WHERE v.id = t.variant_id AND p.id = v.product_id
     RETURNING p.id, p.slug`,
    [[...totals.keys()], [...totals.values()]]
  );
  return res.rows;
}

// Every unit of an order back to stock.
async function restockOrder(client, orderId) {
  const items = await client.query(
    'SELECT variant_id, quantity FROM order_items WHERE order_id = $1',
    [orderId]
  );
  return restock(client, items.rows);
}

module.exports = { restock, restockOrder };
