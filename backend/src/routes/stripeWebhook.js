const express = require('express');
const stripe = require('../config/stripe');
const { syncFromSession, cancelUnpaid } = require('../utils/stripeOrders');

const router = express.Router();

// Mounted before express.json(): signature verification needs the raw body.
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return res.status(503).json({ error: 'Stripe webhooks are not configured' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature'), secret);
  } catch (err) {
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  const session = event.data.object;
  const orderId = session.metadata?.order_id;
  if (!orderId) return res.json({ received: true });

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.expired':
        await syncFromSession(orderId, session);
        break;
      case 'checkout.session.async_payment_failed':
        await cancelUnpaid(orderId);
        break;
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    // A 500 makes Stripe retry the delivery later.
    console.error('Stripe webhook error:', err.message);
    res.status(500).json({ error: 'Webhook handling failed' });
  }
});

module.exports = router;
