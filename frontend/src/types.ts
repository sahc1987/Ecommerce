// Shapes of the API's order, return and user responses. Kept in step with
// mobile/src/types.ts, which describes the same endpoints. Product and category
// types live in utils/pricing.ts.

/** Paging fields every list endpoint returns next to its rows. */
export interface Page {
  total: number;
  page: number;
  pages: number;
}

export type Role = 'admin' | 'staff' | 'customer';

/** The store_settings row, as GET /setup/status returns it. */
export interface StoreSettings {
  name: string;
  description?: string | null;
  logo_url?: string | null;
  /** Contact details; empty strings when not filled in. */
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  currency?: string;
  tax_rate?: string | number;
  tax_enabled?: boolean;
  return_window_days?: number;
  timezone?: string | null;
}

/** A user as the admin Users list returns it. */
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  order_count: string;
}

export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentMethod = 'cod' | 'stripe';
export type PaymentStatus = 'unpaid' | 'paid' | 'canceled' | 'refunded' | 'partially_refunded';

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id?: string | null;
  sku?: string | null;
  /** "Rojo / M"; absent for products without options */
  variant_label?: string | null;
  product_name: string;
  product_image: string | null;
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
  /** Present on GET /orders/:id; status changes return the order without it. */
  items?: OrderItem[];
}

export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'refunded';

export interface ReturnItem {
  id: string;
  return_id: string;
  order_item_id: string;
  quantity: number;
  reason: string | null;
}

export interface ReturnRequest {
  id: string;
  order_id: string;
  user_id: string;
  reason: string;
  status: ReturnStatus;
  refund_amount: string | null;
  admin_notes: string | null;
  restocked?: boolean;
  created_at: string;
  updated_at: string;
  customer_name?: string | null;
  customer_email?: string | null;
  order_total?: string | null;
  order_refunded_amount?: string | null;
  order_payment_method?: PaymentMethod | null;
  items?: ReturnItem[];
}
