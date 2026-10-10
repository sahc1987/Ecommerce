export type Role = 'admin' | 'staff' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active?: boolean;
  created_at?: string;
  order_count?: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  is_primary: boolean;
  sort_order: number;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  compare_at_price: string | null;
  discount_percent: string;
  discount_active: boolean;
  discount_start: string | null;
  discount_end: string | null;
  stock: number;
  /** stock minus units other carts currently hold */
  available_stock?: number;
  sku: string | null;
  category_id: number | null;
  subcategory_id: number | null;
  is_active: boolean;
  created_at: string;
  category_name?: string | null;
  subcategory_name?: string | null;
  primary_image?: string | null;
  images?: ProductImage[] | null;
  /** Pickers the product offers, e.g. Color → [Rojo, Azul]; empty when none. */
  options?: ProductOption[];
  /** Sellable combinations; a product without options has one, with options {}. */
  variants?: Variant[];
  /** Lowest / highest variant price before discount. */
  price_min?: number;
  price_max?: number;
}

export interface ProductOption {
  name: string;
  values: string[];
}

export interface Variant {
  id: string;
  sku: string | null;
  options: Record<string, string>;
  /** null = the product's price */
  price: number | null;
  stock: number;
  is_active: boolean;
  reserved_stock?: number;
  /** stock minus units other carts currently hold */
  available_stock?: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  subcategory_count?: string;
  product_count?: string;
}

export interface Subcategory {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
}

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'cod' | 'stripe';
export type PaymentStatus = 'unpaid' | 'paid' | 'canceled' | 'refunded' | 'partially_refunded';

/** Matches the shape the web checkout posts, so both clients render alike. */
export interface ShippingAddress {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  /** The variant bought, with a snapshot of its SKU and "Rojo / M" label. */
  variant_id?: string | null;
  sku?: string | null;
  variant_label?: string | null;
  product_name: string;
  product_image: string | null;
  /** Column is `unit_price` in the order_items table, not `price`. */
  unit_price: string;
  quantity: number;
  discount: string;
  total: string;
}

export interface Order {
  id: string;
  user_id: string | null;
  status: OrderStatus;
  subtotal: string;
  discount: string;
  tax: string;
  shipping: string;
  total: string;
  shipping_address: ShippingAddress | null;
  notes: string | null;
  tracking_number: string | null;
  carrier: string | null;
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  /** Money given back so far (cancellation or returns). */
  refunded_amount?: string;
  /** Status changes an admin may make next (empty for customers). */
  allowed_next?: OrderStatus[];
  /** Whether the customer may still cancel their own order. */
  can_cancel?: boolean;
  created_at: string;
  updated_at: string;
  customer_name?: string | null;
  customer_email?: string | null;
  item_count?: string;
  items?: OrderItem[];
}

export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'refunded';

export interface ReturnRequest {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  status: ReturnStatus;
  refund_amount: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string | null;
  customer_email?: string | null;
  order_total?: string | null;
  order_refunded_amount?: string | null;
  order_payment_method?: PaymentMethod | null;
  /** Whether a refunded return put its items back on sale. */
  restocked?: boolean;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  /** Column is `metadata` in the notifications table, not `data`. */
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export interface StoreSettings {
  id: number;
  name: string;
  description: string | null;
  logo_url: string | null;
  currency: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  tax_rate: string;
  tax_enabled: boolean;
  return_window_days: number;
  /** IANA zone every date in the app is displayed in */
  timezone?: string;
}

export interface DashboardSummary {
  total_revenue: number;
  total_orders: number;
  total_customers: number;
  active_products: number;
  pending_shipments: number;
  pending_returns: number;
}

/**
 * One line per variant. Carts saved before variants have no variant_id; the
 * server maps those to the product's only variant and the cart fills it in.
 */
export interface CartItem {
  product_id: string;
  variant_id?: string | null;
  /** "Rojo / M"; absent for products without options */
  variant_label?: string | null;
  sku?: string | null;
  name: string;
  slug: string;
  price: number;
  image: string | null;
  quantity: number;
  stock: number;
}
