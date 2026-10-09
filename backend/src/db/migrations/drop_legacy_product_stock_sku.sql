-- Stock and SKU live on product_variants (add_product_variants.sql), so the
-- product-level columns go. Their last values are kept in
-- legacy_product_stock_sku first: the variant backfill skipped duplicate or
-- blank SKUs, and dropping a column can't be undone.
-- Safe to re-run: does nothing once the columns are gone.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'products' AND column_name IN ('stock', 'sku')) THEN
    CREATE TABLE IF NOT EXISTS legacy_product_stock_sku (
      product_id UUID PRIMARY KEY,
      stock INTEGER,
      sku VARCHAR(100),
      saved_at TIMESTAMP DEFAULT NOW()
    );
    EXECUTE $sql$
      INSERT INTO legacy_product_stock_sku (product_id, stock, sku)
      SELECT id, stock, sku FROM products
      ON CONFLICT (product_id) DO NOTHING
    $sql$;
    ALTER TABLE products DROP COLUMN IF EXISTS stock, DROP COLUMN IF EXISTS sku;
  END IF;
END $$;
