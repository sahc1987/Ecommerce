-- IANA time zone the store operates in (dates shown to users, daily sales buckets).
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) DEFAULT 'UTC';
