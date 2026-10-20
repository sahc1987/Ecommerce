-- Every product list and detail reads its images (and the primary one) per
-- product; without this each lookup scans the whole table.
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id, sort_order);
