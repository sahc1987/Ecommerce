const router = require('express').Router();
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const cache = require('../utils/cache');
const safeErr = require('../utils/safeErr');
const { getStoreSettings } = require('../utils/storeSettings');

// Any IANA zone the runtime knows; falls back to UTC for unknown input.
const isValidTimeZone = (tz) => {
  if (typeof tz !== 'string' || !tz) return false;
  try { new Intl.DateTimeFormat(undefined, { timeZone: tz }); return true; } catch { return false; }
};
const TTL = 1800; // 30 minutes

router.get('/status', async (req, res) => {
  try {
    res.json(await cache.cached('setup', 'status', TTL, async () => {
      const store = await getStoreSettings();
      const configured = Object.keys(store).length > 0;
      return { configured, store: configured ? store : null };
    }));
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

router.post('/complete', authenticate, requireRole('admin'), async (req, res) => {
  const { name, description, currency, email, phone, address, tax_rate, tax_enabled, return_window_days, timezone } = req.body;
  if (!name) return res.status(400).json({ error: 'Store name required' });
  if (timezone !== undefined && !isValidTimeZone(timezone)) return res.status(400).json({ error: 'Invalid time zone' });
  const tz = timezone || 'UTC';
  const parsedTaxRate = Math.min(Math.max(Number.parseFloat(tax_rate) || 0, 0), 100);
  const parsedReturnDays = Math.max(1, Number.parseInt(return_window_days) || 30);
  try {
    const existing = await db.query('SELECT id FROM store_settings LIMIT 1');
    let result;
    if (existing.rows.length) {
      result = await db.query(
        `UPDATE store_settings SET name=$1, description=$2, currency=$3, email=$4,
         phone=$5, address=$6, tax_rate=$7, tax_enabled=$8, return_window_days=$9, timezone=$10, updated_at=NOW() WHERE id=$11 RETURNING *`,
        [name, description, currency || 'USD', email, phone, address, parsedTaxRate, !!tax_enabled, parsedReturnDays, tz, existing.rows[0].id]
      );
    } else {
      result = await db.query(
        `INSERT INTO store_settings (name, description, currency, email, phone, address, tax_rate, tax_enabled, return_window_days, timezone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [name, description, currency || 'USD', email, phone, address, parsedTaxRate, !!tax_enabled, parsedReturnDays, tz]
      );
    }
    await cache.invalidateSetup();
    res.json({ store: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

router.post('/logo', authenticate, requireRole('admin'), upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const url = req.file.url;
  try {
    await db.query(
      'UPDATE store_settings SET logo_url=$1, updated_at=NOW() WHERE id=(SELECT id FROM store_settings LIMIT 1)',
      [url]
    );
    await cache.invalidateSetup();
    res.json({ logo_url: url });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

module.exports = router;
