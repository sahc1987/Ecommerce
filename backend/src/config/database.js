const { Pool, types } = require('pg');

// TIMESTAMP (without time zone) columns are written with NOW() on a UTC
// server. Parse them as UTC instead of the API process's local zone so the
// instants sent to clients are correct wherever the API runs.
const TIMESTAMP_OID = 1114;
types.setTypeParser(TIMESTAMP_OID, (value) => (value === null ? null : new Date(value.replace(' ', 'T') + 'Z')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

module.exports = pool;
