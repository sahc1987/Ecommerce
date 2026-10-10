-- One return per order, so simultaneous requests can't both get through.
-- Fails if an order already has several returns; resolve those first.
-- It also serves lookups by order, replacing the plain idx_returns_order_id.
CREATE UNIQUE INDEX IF NOT EXISTS idx_returns_one_per_order ON returns(order_id);
DROP INDEX IF EXISTS idx_returns_order_id;
