const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { optionalAuth } = require('../middleware/auth');
const safeErr = require('../utils/safeErr');
const reservations = require('../utils/reservations');
const variants = require('../utils/variants');

// Carts sync on every change; keep it generous but bounded.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many cart updates, please slow down.' },
});

const MAX_ITEMS = 50;
const { UUID_RE } = variants;

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
  if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
  // An empty list is valid here: it releases every hold of this cart.
  const invalid = items.length ? variants.validateLines(items, MAX_ITEMS) : null;
  if (invalid) return res.status(400).json({ error: invalid });
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

// DELETE release one variant, all variants of one product, or everything
router.delete('/:id?', async (req, res) => {
  if (req.params.id && !UUID_RE.test(req.params.id))
    return res.status(400).json({ error: 'Invalid variant or product id' });
  try {
    await reservations.releaseReservations(req.cartToken, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

module.exports = router;
