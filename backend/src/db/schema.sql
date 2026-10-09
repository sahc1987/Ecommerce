-- Store settings
CREATE TABLE IF NOT EXISTS store_settings (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  logo_url VARCHAR(500),
  currency VARCHAR(10) DEFAULT 'USD',
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  tax_rate DECIMAL(5,2) DEFAULT 0,
  tax_enabled BOOLEAN DEFAULT FALSE,
  return_window_days INTEGER DEFAULT 30,
  timezone VARCHAR(64) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Migration: add tax columns to existing store_settings tables
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 0;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tax_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS return_window_days INTEGER DEFAULT 30;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'UTC';

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'customer' CHECK (role IN ('admin', 'staff', 'customer')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Subcategories
CREATE TABLE IF NOT EXISTS subcategories (
  id SERIAL PRIMARY KEY,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(category_id, slug)
);

-- Products
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  discount_percent DECIMAL(5,2) DEFAULT 0,
  discount_active BOOLEAN DEFAULT FALSE,
  discount_start TIMESTAMP,
  discount_end TIMESTAMP,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Product images
CREATE TABLE IF NOT EXISTS product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','paid','processing','shipped','delivered','cancelled')),
  subtotal DECIMAL(10,2) NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  shipping DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  shipping_address JSONB,
  notes TEXT,
  tracking_number VARCHAR(100),
  carrier VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name VARCHAR(255) NOT NULL,
  product_image VARCHAR(500),
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INTEGER NOT NULL,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL
);

-- Returns / Refunds
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','refunded')),
  refund_amount DECIMAL(10,2),
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Return items
CREATE TABLE IF NOT EXISTS return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID REFERENCES returns(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  reason TEXT
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_returns_user_id ON returns(user_id);
CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);
-- Temporary stock holds created when a product is added to a cart.
-- Available stock = product_variants.stock - SUM(quantity) of non-expired rows
-- (holds are per variant; see add_product_variants below).
CREATE TABLE IF NOT EXISTS stock_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  cart_token VARCHAR(64) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (product_id, cart_token)
);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_product_expires ON stock_reservations(product_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_cart ON stock_reservations(cart_token);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_expires ON stock_reservations(expires_at);

-- Stored responses for idempotent order placement (Idempotency-Key header).
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key VARCHAR(128) NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_hash VARCHAR(64) NOT NULL,
  status_code INTEGER,
  response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (key, user_id)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_created ON idempotency_keys(created_at);

-- How an order is paid for, and the Stripe Checkout session that collects it.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) DEFAULT 'cod';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'unpaid';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_session_id VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stripe_payment_intent VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);

-- Product variants: each sellable combination (e.g. Color=Rojo, Talla=M) has its
-- own SKU, optional price override and stock. Every product has at least one
-- variant; a product without options has a single "default" variant ({}).
-- products.stock / products.sku were copied into default variants here and are
-- dropped by drop_legacy_product_stock_sku.sql.
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
-- rather than failing the whole init. Only while the legacy columns exist
-- (dynamic SQL, so this still parses once they are dropped); after that a
-- product without variants just gets an empty default one.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = current_schema() AND table_name = 'products' AND column_name = 'stock') THEN
    EXECUTE $sql$
      INSERT INTO product_variants (product_id, sku, stock)
      SELECT p.id,
             CASE WHEN p.clean_sku IS NOT NULL
                   AND COUNT(*) OVER (PARTITION BY p.clean_sku) = 1
                   AND NOT EXISTS (SELECT 1 FROM product_variants v2 WHERE v2.sku = p.clean_sku)
                  THEN p.clean_sku END,
             GREATEST(COALESCE(p.stock, 0), 0)
      FROM (SELECT id, stock, NULLIF(TRIM(sku), '') AS clean_sku FROM products) p
      WHERE NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id)
    $sql$;
  END IF;
END $$;
INSERT INTO product_variants (product_id)
SELECT p.id FROM products p
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
