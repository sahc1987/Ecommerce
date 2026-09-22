-- Temporary stock holds created when a product is added to a cart.
-- Available stock = products.stock - SUM(quantity) of non-expired rows.
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
