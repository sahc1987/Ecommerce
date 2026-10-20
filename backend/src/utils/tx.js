const db = require('../config/database');

// Runs fn(client) in one transaction on a pooled client: COMMIT when it
// resolves, ROLLBACK (and rethrow) when it throws. Use a thrown domain error
// (OrderConflict, ReturnRejected…) to abandon the transaction with an answer
// for the client, so a rejected request can never leave a partial write.
async function withTransaction(fn) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { withTransaction };
