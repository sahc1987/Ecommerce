-- Product variants: each sellable combination (e.g. Color=Rojo, Talla=M) has its
-- own SKU, optional price override and stock. Every product has at least one
-- variant; a product without options has a single "default" variant ({}).
-- products.stock / products.sku are legacy and no longer read.
-- Safe to re-run: schema.sql (which includes this) runs on every startup.

-- The option pickers a product offers, e.g. "Color" → {Rojo, Azul}.
CREATE TABLE IF NOT EXISTS product_options (
  id SERIAL PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  "values" TEXT[] NOT NULL,
  position INTEGER DEFAULT 0,
  UNIQUE (product_id, name)
);

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(100) UNIQUE,
  options JSONB NOT NULL DEFAULT '{}',   -- {} = default variant
  price DECIMAL(10,2) CHECK (price >= 0), -- NULL = use products.price
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  is_active BOOLEAN DEFAULT TRUE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (product_id, options)
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);

-- Give every product without variants a default one carrying its stock and SKU.
-- SKUs that are blank, duplicated, or already taken by a variant are dropped
-- rather than failing the whole init.
INSERT INTO product_variants (product_id, sku, stock)
SELECT p.id,
       CASE WHEN p.clean_sku IS NOT NULL
             AND COUNT(*) OVER (PARTITION BY p.clean_sku) = 1
             AND NOT EXISTS (SELECT 1 FROM product_variants v2 WHERE v2.sku = p.clean_sku)
            THEN p.clean_sku END,
       GREATEST(COALESCE(p.stock, 0), 0)
FROM (SELECT id, stock, NULLIF(TRIM(sku), '') AS clean_sku FROM products) p
WHERE NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id);

-- Cart holds are per variant. Holds last minutes, so any that can't be mapped
-- to a single variant are simply dropped.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'stock_reservations' AND column_name = 'variant_id') THEN
    ALTER TABLE stock_reservations ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE;
    UPDATE stock_reservations r SET variant_id = v.id
      FROM product_variants v
      WHERE v.product_id = r.product_id
        AND (SELECT COUNT(*) FROM product_variants v2 WHERE v2.product_id = r.product_id) = 1;
    DELETE FROM stock_reservations WHERE variant_id IS NULL;
    ALTER TABLE stock_reservations ALTER COLUMN variant_id SET NOT NULL;
    ALTER TABLE stock_reservations DROP CONSTRAINT IF EXISTS stock_reservations_product_id_cart_token_key;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_reservations_variant_cart ON stock_reservations(variant_id, cart_token);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_variant_expires ON stock_reservations(variant_id, expires_at);

-- Orders record which variant was bought, with a snapshot of its SKU and label
-- ("Rojo / M") so history survives the variant being edited or deleted.
-- Existing lines are linked once, to their product's only variant.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = current_schema() AND table_name = 'order_items' AND column_name = 'variant_id') THEN
    ALTER TABLE order_items
      ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
      ADD COLUMN sku VARCHAR(100),
      ADD COLUMN variant_label VARCHAR(255);
    UPDATE order_items oi SET variant_id = v.id, sku = v.sku
      FROM product_variants v
      WHERE v.product_id = oi.product_id
        AND (SELECT COUNT(*) FROM product_variants v2 WHERE v2.product_id = oi.product_id) = 1;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_order_items_variant_id ON order_items(variant_id);
