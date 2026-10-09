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

export const formatPrice = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
