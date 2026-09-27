import type {Product} from '../types';

let activeCurrency = 'USD';

// Dates are rendered in the store's zone (a store setting), not the device's,
// so every client shows the same "placed on" day.
let activeTimeZone = 'UTC';

export const isValidTimeZone = (tz: string) => {
  try {
    // Throws RangeError for zones the runtime does not know.
    new Intl.DateTimeFormat(undefined, {timeZone: tz}).resolvedOptions();
    return true;
  } catch {
    return false;
  }
};

export const setTimeZone = (tz?: string | null) => {
  if (tz && isValidTimeZone(tz)) {
    activeTimeZone = tz;
  }
};

export const deviceTimeZone = () =>
  new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const formatIn = (iso: string, options: Intl.DateTimeFormatOptions) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  try {
    return new Intl.DateTimeFormat('en-US', {...options, timeZone: activeTimeZone}).format(d);
  } catch {
    return d.toLocaleDateString('en-US', options);
  }
};

/** Units a shopper can buy right now: stock minus other carts' active holds. */
export const sellableStock = (p: Pick<Product, 'stock' | 'available_stock'>) =>
  p.available_stock ?? p.stock;

export const setCurrency = (code?: string | null) => {
  if (code) {
    activeCurrency = code;
  }
};

export const formatMoney = (value: number | string | null | undefined) => {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value ?? 0;
  const safe = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: activeCurrency,
    }).format(safe);
  } catch {
    return `${activeCurrency} ${safe.toFixed(2)}`;
  }
};

export const formatDate = (iso?: string | null) => {
  if (!iso) {
    return '';
  }
  return formatIn(iso, {year: 'numeric', month: 'short', day: 'numeric'});
};

export const formatDateTime = (iso?: string | null) => {
  if (!iso) {
    return '';
  }
  return formatIn(iso, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
};

export const shortId = (id?: string | null) =>
  id ? id.slice(0, 8).toUpperCase() : '';

/**
 * Mirrors the server's price logic in payments.js so the cart total the user
 * sees matches the total the server computes at checkout.
 */
export const effectivePrice = (product: Product): number => {
  const base = Number.parseFloat(product.price);
  const percent = Number.parseFloat(product.discount_percent ?? '0');
  if (!product.discount_active || percent <= 0) {
    return base;
  }
  const now = Date.now();
  const start = product.discount_start ? new Date(product.discount_start).getTime() : null;
  const end = product.discount_end ? new Date(product.discount_end).getTime() : null;
  if ((!start || now >= start) && (!end || now <= end)) {
    return base * (1 - percent / 100);
  }
  return base;
};

export const isDiscounted = (product: Product) =>
  effectivePrice(product) < Number.parseFloat(product.price);
