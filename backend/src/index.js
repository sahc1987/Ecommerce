require('dotenv').config();

// Refuse to run without these rather than failing on every login or query.
for (const name of ['JWT_SECRET', 'DATABASE_URL']) {
  if (!process.env[name]) {
    console.error(`${name} is not set. Add it to backend/.env (see .env.example).`);
    process.exit(1);
  }
}

const app = require('./app');
const db = require('./config/database');

// Purge expired stock holds so the reservations table stays small
require('./utils/reservations').startExpiryJob();
// Settle card orders whose Stripe webhook never arrived
require('./utils/stripeOrders').startSweeper();

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// `docker stop` sends SIGTERM: finish in-flight requests, then close the
// database pool, instead of dropping them mid-transaction.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => {
    console.log(`${signal} received, shutting down`);
    server.close(() => {
      db.end().finally(() => process.exit(0));
    });
    // Don't hang forever on a stuck connection.
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
