-- Money given back on an order (cancellation or returns), so a refund can never
-- exceed what was paid. payment_status gains 'refunded' / 'partially_refunded'.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Whether a refunded return put its items back on sale (the admin chooses).
ALTER TABLE returns ADD COLUMN IF NOT EXISTS restocked BOOLEAN NOT NULL DEFAULT FALSE;
