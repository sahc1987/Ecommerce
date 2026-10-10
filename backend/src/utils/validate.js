// Request validation shared by the routes.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value) => typeof value === 'string' && UUID_RE.test(value);

// For router.param(): a malformed id can't match any row, so answer 404 here
// instead of letting Postgres reject it as invalid input (a 500).
const uuidParam = (message) => (req, res, next, value) =>
  isUuid(value) ? next() : res.status(404).json({ error: message });

// page and limit from the query string, clamped so a bad value (page=0, a
// negative or huge limit) can't produce an invalid OFFSET or an unbounded query.
function pagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit), maxLimit);
  return { page, limit, offset: (page - 1) * limit };
}

module.exports = { UUID_RE, isUuid, uuidParam, pagination };
