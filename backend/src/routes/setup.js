const router = require('express').Router();
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/status', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM store_settings LIMIT 1');
    res.json({ configured: result.rows.length > 0, store: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/complete', authenticate, requireRole('admin'), async (req, res) => {
  const { name, description, currency, email, phone, address, tax_rate, tax_enabled } = req.body;
  if (!name) return res.status(400).json({ error: 'Store name required' });
  const parsedTaxRate = Math.min(Math.max(Number.parseFloat(tax_rate) || 0, 0), 100);
  try {
    const existing = await db.query('SELECT id FROM store_settings LIMIT 1');
    let result;
    if (existing.rows.length) {
      result = await db.query(
        `UPDATE store_settings SET name=$1, description=$2, currency=$3, email=$4,
         phone=$5, address=$6, tax_rate=$7, tax_enabled=$8, updated_at=NOW() WHERE id=$9 RETURNING *`,
        [name, description, currency || 'USD', email, phone, address, parsedTaxRate, !!tax_enabled, existing.rows[0].id]
      );
    } else {
      result = await db.query(
        `INSERT INTO store_settings (name, description, currency, email, phone, address, tax_rate, tax_enabled)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [name, description, currency || 'USD', email, phone, address, parsedTaxRate, !!tax_enabled]
      );
    }
    res.json({ store: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/logo',
  authenticate,
  requireRole('admin'),
  upload.single('logo'),
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    try {
      await db.query(
        'UPDATE store_settings SET logo_url=$1, updated_at=NOW() WHERE id=(SELECT id FROM store_settings LIMIT 1)',
        [url]
      );
      res.json({ logo_url: url });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
