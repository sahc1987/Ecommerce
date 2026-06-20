// Returns a safe error message string: detailed in dev, generic in production
const safeErr = (err) =>
  process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

module.exports = safeErr;
