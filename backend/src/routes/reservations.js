const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { optionalAuth } = require('../middleware/auth');
const safeErr = require('../utils/safeErr');
const reservations = require('../utils/reservations');

// Carts sync on every change; keep it generous but bounded.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many cart updates, please slow down.' },
});

const MAX_ITEMS = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_QTY = 1000;

// Every route needs a cart token to identify whose holds these are.
router.use(limiter, optionalAuth, (req, res, next) => {
  const token = reservations.getCartToken(req);
  if (!token) return res.status(400).json({ error: 'Missing or invalid X-Cart-Token header' });
  req.cartToken = token;
  next();
});

// GET current holds for this cart
router.get('/', async (req, res) => {
  try {
    res.json(await reservations.getReservations(req.cartToken));
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// PUT replace this cart's holds with the given items (renews the timer)
router.put('/', async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length > MAX_ITEMS)
    return res.status(400).json({ error: 'items must be an array' });
  for (const it of items) {
    const qty = Number.parseInt(it?.quantity, 10);
    if (!UUID_RE.test(String(it?.product_id)) || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY)
      return res.status(400).json({ error: 'Each item needs a valid product_id and quantity (1-1000)' });
  }
  try {
    res.json(await reservations.syncReservations({
      cartToken: req.cartToken,
      userId: req.user?.id || null,
      items,
    }));
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// POST extend all holds for this cart by the full window
router.post('/renew', async (req, res) => {
  try {
    res.json(await reservations.renewReservations(req.cartToken));
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

// DELETE release one product (or everything) for this cart
router.delete('/:productId?', async (req, res) => {
  if (req.params.productId && !UUID_RE.test(req.params.productId))
    return res.status(400).json({ error: 'Invalid product id' });
  try {
    await reservations.releaseReservations(req.cartToken, req.params.productId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

module.exports = router;
