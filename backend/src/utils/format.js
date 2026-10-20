// Text shown to people in notifications.

// "1A2B3C4D": how orders and returns are referred to (the apps do the same).
const shortId = (id) => String(id).slice(0, 8).toUpperCase();

const formatMoney = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

module.exports = { shortId, formatMoney };
