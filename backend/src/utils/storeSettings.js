const db = require('../config/database');
const { formatMoney } = require('./format');

// The single store_settings row ({} before setup). Pass the transaction's
// client when the caller is inside one (e.g. pricing an order).
async function getStoreSettings(client = db) {
  const res = await client.query('SELECT * FROM store_settings LIMIT 1');
  return res.rows[0] ?? {};
}

// A formatter for amounts in the store's currency ("$1,234.50", "€12.00"),
// for notification texts.
async function storeMoneyFormatter() {
  const { currency } = await getStoreSettings();
  return (amount) => formatMoney(Number(amount), currency || 'USD');
}

module.exports = { getStoreSettings, storeMoneyFormatter };
