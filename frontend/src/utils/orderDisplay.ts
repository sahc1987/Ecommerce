// How orders and returns look everywhere in the app (shop and back office), so
// a status has one colour. Mirrors statusColor in mobile/src/theme/index.ts.
// Colour roles (index.css): amber = waiting, blue = in progress,
// violet = on its way, emerald = done, rose = stopped.

const NEUTRAL = 'bg-slate-100 text-slate-800';

const ORDER_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-primary-100 text-primary-800',
  processing: 'bg-primary-100 text-primary-800',
  shipped: 'bg-violet-100 text-violet-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
};

// Solid swatches for bars and dots (dashboard status strip).
const ORDER_BAR: Record<string, string> = {
  pending: 'bg-amber-400',
  paid: 'bg-primary-400',
  processing: 'bg-primary-600',
  shipped: 'bg-violet-500',
  delivered: 'bg-emerald-500',
  cancelled: 'bg-rose-400',
};

const RETURN_BADGE: Record<string, string> = {
  requested: 'bg-amber-100 text-amber-800',
  approved: 'bg-primary-100 text-primary-800',
  rejected: 'bg-rose-100 text-rose-800',
  refunded: 'bg-emerald-100 text-emerald-800',
};

/** Classes for an order status badge (use with the `badge` utility). */
export const orderBadge = (status: string): string => ORDER_BADGE[status] ?? NEUTRAL;

/** Solid colour of an order status, for bars and dots. */
export const orderBar = (status: string): string => ORDER_BAR[status] ?? 'bg-slate-300';

/** Classes for a return status badge. */
export const returnBadge = (status: string): string => RETURN_BADGE[status] ?? NEUTRAL;

/** "1A2B3C4D": how orders and returns are referred to (as in notifications). */
export const shortId = (id: string | number): string => String(id).slice(0, 8).toUpperCase();
