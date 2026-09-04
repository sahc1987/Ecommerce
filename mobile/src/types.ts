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
  sku: string | null;
  category_id: number | null;
  subcategory_id: number | null;
  is_active: boolean;
  created_at: string;
  category_name?: string | null;
  subcategory_name?: string | null;
  primary_image?: string | null;
  images?: ProductImage[] | null;
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
}

export interface DashboardSummary {
  total_revenue: number;
  total_orders: number;
  total_customers: number;
  active_products: number;
  pending_shipments: number;
  pending_returns: number;
}

export interface CartItem {
  product_id: string;
  name: string;
  slug: string;
  price: number;
  image: string | null;
  quantity: number;
  stock: number;
}
