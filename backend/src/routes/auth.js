const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const safeErr = require('../utils/safeErr');

// ponytail: per-IP throttle on credential endpoints — blunts brute force / signup spam.
// 10 req / 15 min is generous for real users; tighten if abuse shows up.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later.' },
});

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Cross-site cookies are required when the frontend and backend are served from
// different domains (e.g. Cloudflare Pages + Render). Browsers only accept
// SameSite=None when the cookie is also Secure (HTTPS), so force secure on.
const crossSite = process.env.CROSS_SITE_COOKIES === 'true';
const COOKIE_BASE = {
  httpOnly: true,
  secure: crossSite || process.env.NODE_ENV === 'production',
  sameSite: crossSite ? 'none' : 'strict',
  path: '/',
};

const COOKIE_OPTS = { ...COOKIE_BASE, maxAge: 7 * 24 * 60 * 60 * 1000 };

// Native clients (React Native) have no reliable cookie jar, so they opt in with
// `X-Client: mobile` and receive the JWT in the response body to keep in SecureStore.
// Web clients see the unchanged cookie-only response.
const authPayload = (req, user, token) =>
  req.get('X-Client') === 'mobile' ? { user, token } : { user };

router.post('/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });
  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(400).json({ error: 'Email already in use' });
    const hash = await bcrypt.hash(password, 10);
    const countRes = await db.query('SELECT COUNT(*) FROM users');
    const role = Number.parseInt(countRes.rows[0].count) === 0 ? 'admin' : 'customer';
    const result = await db.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
      [name, email, hash, role]
    );
    const user = result.rows[0];
    const token = generateToken(user.id);
    res.cookie('token', token, COOKIE_OPTS);
    res.status(201).json(authPayload(req, user, token));
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1 AND is_active = TRUE', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Invalid credentials' });
    const { password_hash, ...userData } = user;
    const token = generateToken(user.id);
    res.cookie('token', token, COOKIE_OPTS);
    res.json(authPayload(req, userData, token));
  } catch (err) {
    res.status(500).json({ error: safeErr(err) });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', COOKIE_BASE);
  res.json({ success: true });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
