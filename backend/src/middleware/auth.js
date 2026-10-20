const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Web clients send the JWT in an httpOnly cookie; native clients (React Native)
// cannot rely on a cookie jar, so they send it as `Authorization: Bearer <token>`.
const extractToken = (req) => {
  if (req.cookies?.token) return req.cookies.token;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
};

// The active user a token belongs to, or null (deactivated or deleted).
// Throws when the token is invalid or expired. Looked up on every request so
// deactivating an account takes effect immediately.
async function userFromToken(token) {
  const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  const result = await db.query(
    'SELECT id, name, email, role FROM users WHERE id = $1 AND is_active = TRUE',
    [decoded.userId]
  );
  return result.rows[0] ?? null;
}

const authenticate = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const user = await userFromToken(token);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Like authenticate, but guests pass through with req.user unset.
const optionalAuth = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const user = await userFromToken(token);
    if (user) req.user = user;
  } catch {
    // invalid/expired token: treat as guest
  }
  next();
};

const STAFF_ROLES = ['admin', 'staff'];

// Back-office users see every order and return; customers only their own.
const isStaff = (user) => STAFF_ROLES.includes(user?.role);

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

const requireStaff = requireRole(...STAFF_ROLES);

module.exports = { authenticate, optionalAuth, requireRole, requireStaff, isStaff, extractToken };
