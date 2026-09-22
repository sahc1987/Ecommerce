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
}

export interface Category {
  id: string;
  name: string;
  image_url?: string | null;
}

export const hasActiveDiscount = (p: Product): boolean => {
  if (!p.discount_active || !p.discount_percent) return false;
  const now = new Date();
  if (p.discount_start && new Date(p.discount_start) > now) return false;
  if (p.discount_end && new Date(p.discount_end) < now) return false;
  return true;
};

export const getEffectivePrice = (p: Product): number => {
  const base = Number.parseFloat(p.price);
  if (!hasActiveDiscount(p)) return base;
  return base * (1 - Number.parseFloat(p.discount_percent as string) / 100);
};

// Units a shopper can actually buy right now.
export const sellableStock = (p: Pick<Product, 'stock' | 'available_stock'>): number =>
  p.available_stock ?? p.stock;

export const formatPrice = (n: number): string =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
