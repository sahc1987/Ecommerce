// Which status changes an order may make. Every route that changes an order's
// status checks here, and order responses carry `allowed_next` so the apps
// show only valid choices instead of keeping their own copy of the rules.
//
//   pending    → paid, cancelled      (paid by hand only for cash on delivery)
//   paid       → processing, shipped, cancelled
//   processing → shipped, cancelled
//   shipped    → delivered
//   delivered, cancelled: final (problems after delivery go through Returns)

const TRANSITIONS = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const STATUSES = Object.keys(TRANSITIONS);

// Customers may cancel their own order until the store starts preparing it.
const CUSTOMER_CANCELLABLE = new Set(['pending', 'paid']);

// Card orders become paid only when Stripe confirms the payment, never by hand.
const awaitingCardPayment = (order) =>
  order.payment_method === 'stripe' && order.payment_status !== 'paid';

function allowedNext(order) {
  const next = TRANSITIONS[order.status] ?? [];
  return awaitingCardPayment(order) ? next.filter((s) => s !== 'paid') : next;
}

const canTransition = (order, status) => allowedNext(order).includes(status);

const canCustomerCancel = (order) => CUSTOMER_CANCELLABLE.has(order.status);

// Why `order` can't move to `status`, for the 409 message.
function transitionError(order, status) {
  if (status === 'paid' && awaitingCardPayment(order))
    return 'Card orders are marked paid automatically when Stripe confirms the payment';
  if (!allowedNext(order).length) return `This order is ${order.status} and can no longer change`;
  return `Can't change a ${order.status} order to ${status}`;
}

module.exports = {
  STATUSES,
  allowedNext,
  canTransition,
  canCustomerCancel,
  transitionError,
};
