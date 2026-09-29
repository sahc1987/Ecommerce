const Stripe = require('stripe');

// Configured only when a secret key is present. Without one the app still runs
// and checkout offers Cash on Delivery only.
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

module.exports = stripe;
