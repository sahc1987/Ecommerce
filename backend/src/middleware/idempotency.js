const crypto = require('crypto');
const db = require('../config/database');

// Keys are remembered for this long; a retry after that creates a new order.
const KEY_TTL_HOURS = 24;
const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;

const hashBody = (body) =>
  crypto.createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');

// Idempotent POST for authenticated routes, keyed by `Idempotency-Key` + user.
//  - first request: reserve the key, run the handler, store its JSON response
//  - retry with same key + same body: replay the stored response (no new order)
//  - same key while the first is still running: 409
//  - same key with a different body: 422
// Requests without the header behave as before (not idempotent).
async function idempotent(req, res, next) {
  const key = req.get('Idempotency-Key');
  if (!key) return next();
  if (!KEY_RE.test(key)) return res.status(400).json({ error: 'Invalid Idempotency-Key' });
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });

  const requestHash = hashBody(req.body);
  try {
    // Purge stale keys opportunistically (cheap thanks to the created_at index).
    await db.query(
      `DELETE FROM idempotency_keys WHERE created_at < NOW() - INTERVAL '${KEY_TTL_HOURS} hours'`
    );

    const inserted = await db.query(
      `INSERT INTO idempotency_keys (key, user_id, request_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (key, user_id) DO NOTHING
       RETURNING key`,
      [key, req.user.id, requestHash]
    );

    if (!inserted.rows[0]) {
      const existing = await db.query(
        'SELECT request_hash, status_code, response FROM idempotency_keys WHERE key = $1 AND user_id = $2',
        [key, req.user.id]
      );
      const row = existing.rows[0];
      if (row.request_hash !== requestHash) {
        return res.status(422).json({ error: 'Idempotency-Key was already used with a different request' });
      }
      if (row.status_code == null) {
        return res.status(409).json({ error: 'A request with this Idempotency-Key is still being processed' });
      }
      res.set('Idempotent-Replayed', 'true');
      return res.status(row.status_code).json(row.response);
    }
  } catch (err) {
    return next(err);
  }

  // Capture the handler's JSON response and persist it against the key.
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const status = res.statusCode || 200;
    const finish = originalJson(body);
    // A failed attempt (4xx/5xx) should be retryable, so only successes are kept.
    const op = status < 400
      ? db.query(
          'UPDATE idempotency_keys SET status_code = $3, response = $4 WHERE key = $1 AND user_id = $2',
          [key, req.user.id, status, JSON.stringify(body)]
        )
      : db.query('DELETE FROM idempotency_keys WHERE key = $1 AND user_id = $2', [key, req.user.id]);
    op.catch(() => {});
    return finish;
  };

  // If the handler dies without responding, free the key so the client can retry.
  res.on('close', () => {
    if (!res.headersSent) {
      db.query('DELETE FROM idempotency_keys WHERE key = $1 AND user_id = $2', [key, req.user.id]).catch(() => {});
    }
  });

  next();
}

module.exports = { idempotent };
