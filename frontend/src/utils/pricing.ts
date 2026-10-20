export interface ProductOption {
  name: string;          // e.g. "Color"
  values: string[];      // e.g. ["Rojo", "Azul"]
}

// One sellable combination of option values. A product without options has a
// single variant whose `options` is {}.
export interface Variant {
  id: string;
  sku: string | null;
  options: Record<string, string>;
  price: number | null;  // null = the product's price
  stock: number;
  is_active: boolean;
  reserved_stock?: number;
  available_stock?: number; // stock minus other carts' active holds
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  price: string;
  compare_at_price: string | null;
  stock: number;
  available_stock?: number; // stock minus other carts' active holds
  primary_image: string | null;
  discount_active: boolean;
  discount_percent: string | null;
  discount_start: string | null;
  discount_end: string | null;
  category_name: string | null;
  category_id?: string | null;
  options?: ProductOption[];
  variants?: Variant[];
  price_min?: number;
  price_max?: number;
  /** Units in orders that weren't cancelled (public list endpoint). */
  units_sold?: number;
}

export interface Category {
  id: string;
  name: string;
  image_url?: string | null;
}

type DiscountFields = Pick<Product, 'discount_active' | 'discount_percent' | 'discount_start' | 'discount_end'>;

export const hasActiveDiscount = (p: DiscountFields): boolean => {
  if (!p.discount_active || !p.discount_percent) return false;
  const now = new Date();
  if (p.discount_start && new Date(p.discount_start) > now) return false;
  if (p.discount_end && new Date(p.discount_end) < now) return false;
  return true;
};

// The product's running discount applied to any base price.
export const applyDiscount = (p: DiscountFields, base: number): number =>
  hasActiveDiscount(p) ? base * (1 - Number.parseFloat(p.discount_percent as string) / 100) : base;

export const getEffectivePrice = (p: Product): number => applyDiscount(p, Number.parseFloat(p.price));

// Base (pre-discount) price of a variant: its own, or the product's.
export const variantBasePrice = (p: Pick<Product, 'price'>, v: Pick<Variant, 'price'>): number =>
  v.price ?? Number.parseFloat(p.price);

// Lowest and highest price after discount, across sellable variants.
export const effectivePriceRange = (p: Product): { min: number; max: number } => {
  const base = Number.parseFloat(p.price);
  return {
    min: applyDiscount(p, p.price_min ?? base),
    max: applyDiscount(p, p.price_max ?? base),
  };
};

// A product the shopper can add without picking options: it has exactly one
// variant (the default one). Products from older APIs have no variant list.
export const singleVariant = (p: Product): Variant | null => {
  if (p.options?.length) return null;
  return p.variants?.length === 1 ? p.variants[0] : null;
};

export const needsOptions = (p: Product): boolean => Boolean(p.options?.length);

// "Rojo / M" in option order; null for the default variant.
export const variantLabel = (options: ProductOption[] | undefined, combo: Record<string, string>): string | null => {
  const parts = (options ?? []).map((o) => combo[o.name]).filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
};

// Units a shopper can actually buy right now.
export const sellableStock = (p: Pick<Product, 'stock' | 'available_stock'>): number =>
  p.available_stock ?? p.stock;

/** Currencies a store can sell in (setup wizard and Store Settings). */
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'BRL', 'MXN'];

// Every amount is shown in the store's currency (a store setting), as the API
// charges it. useStoreSettings sets it when the settings load.
let storeCurrency = 'USD';

const isCurrency = (code: string) => {
  try {
    new Intl.NumberFormat('en-US', { style: 'currency', currency: code });
    return true;
  } catch {
    return false;
  }
};

export const setStoreCurrency = (code?: string | null) => {
  if (code && isCurrency(code)) storeCurrency = code;
};

/** The store currency's symbol, e.g. "$", "€", "CA$", for input prefixes. */
export const currencySymbol = (): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: storeCurrency })
    .formatToParts(0)
    .find((p) => p.type === 'currency')?.value ?? storeCurrency;

/**
 * An amount in the store's currency: "$1,549.36", "€12.00". Accepts numbers
 * (cart) or numeric strings (API DECIMAL columns); `options` can e.g. drop the
 * cents or make it compact ("$1.2K") for charts.
 */
export const formatPrice = (value: number | string, options: Intl.NumberFormatOptions = {}): string => {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value;
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { style: 'currency', currency: storeCurrency, ...options });
};

interface PricedLine {
  price: number;
  effective_price: number;
  quantity: number;
}

/**
 * Cart totals as POST /payments/place-order computes them: tax on the
 * discounted subtotal (rounded to the cent) when the store charges tax, and no
 * shipping. The cart and checkout pages both show these.
 */
export function cartTotals(lines: PricedLine[], store?: { tax_enabled?: boolean; tax_rate?: string | number } | null) {
  const sum = (f: (l: PricedLine) => number) => lines.reduce((total, l) => total + f(l), 0);
  const subtotal = sum((l) => l.effective_price * l.quantity);
  const taxRate = store?.tax_enabled ? Number.parseFloat(String(store.tax_rate ?? 0)) || 0 : 0;
  const tax = taxRate > 0 ? Number.parseFloat((subtotal * taxRate / 100).toFixed(2)) : 0;
  return {
    count: sum((l) => l.quantity),
    subtotal,
    savings: sum((l) => (l.price - l.effective_price) * l.quantity),
    tax,
    total: subtotal + tax,
  };
}
