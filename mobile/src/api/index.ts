import api from './client';
import type {
  AppNotification,
  Category,
  DashboardSummary,
  Order,
  OrderStatus,
  Product,
  ReturnRequest,
  ReturnStatus,
  ShippingAddress,
  StoreSettings,
  Subcategory,
  User,
} from '../types';

type Page = {total: number; page: number; pages: number};

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{user: User; token: string}>('/auth/login', {email, password}),
  register: (name: string, email: string, password: string) =>
    api.post<{user: User; token: string}>('/auth/register', {
      name,
      email,
      password,
    }),
  me: () => api.get<{user: User}>('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

export const setupApi = {
  status: () =>
    api.get<{configured: boolean; store: StoreSettings | null}>('/setup/status'),
  complete: (payload: Record<string, unknown>) =>
    api.post<{store: StoreSettings}>('/setup/complete', payload),
};

export const productsApi = {
  list: (params: {
    category?: number | string;
    subcategory?: number | string;
    search?: string;
    discount?: 'true';
    page?: number;
    limit?: number;
  }) => api.get<{products: Product[]} & Page>('/products', {params}),
  adminList: (params: {
    category?: number | string;
    subcategory?: number | string;
    search?: string;
    page?: number;
    limit?: number;
  }) => api.get<{products: Product[]} & Page>('/products/admin/all', {params}),
  detail: (idOrSlug: string) => api.get<{product: Product}>('/products/' + idOrSlug),
  create: (payload: Record<string, unknown>) =>
    api.post<{product: Product}>('/products', payload),
  update: (id: string, payload: Record<string, unknown>) =>
    api.put<{product: Product}>('/products/' + id, payload),
  remove: (id: string) => api.delete('/products/' + id),
  uploadImages: (id: string, form: FormData) =>
    api.post('/products/' + id + '/images', form, {
      headers: {'Content-Type': 'multipart/form-data'},
      timeout: 60000,
    }),
  deleteImage: (id: string, imageId: string) =>
    api.delete('/products/' + id + '/images/' + imageId),
  makePrimary: (id: string, imageId: string) =>
    api.put('/products/' + id + '/images/' + imageId + '/primary'),
};

export const categoriesApi = {
  list: () => api.get<{categories: Category[]}>('/categories'),
  subcategories: (categoryId: number | string) =>
    api.get<{subcategories: Subcategory[]}>(
      '/categories/' + categoryId + '/subcategories',
    ),
  create: (form: FormData) =>
    api.post('/categories', form, {
      headers: {'Content-Type': 'multipart/form-data'},
      timeout: 60000,
    }),
  update: (id: number, form: FormData) =>
    api.put('/categories/' + id, form, {
      headers: {'Content-Type': 'multipart/form-data'},
      timeout: 60000,
    }),
  remove: (id: number) => api.delete('/categories/' + id),
  createSub: (categoryId: number, payload: {name: string; description?: string}) =>
    api.post('/categories/' + categoryId + '/subcategories', payload),
  updateSub: (id: number, payload: Record<string, unknown>) =>
    api.put('/categories/subcategories/' + id, payload),
  removeSub: (id: number) => api.delete('/categories/subcategories/' + id),
};

export const ordersApi = {
  list: (params: {status?: OrderStatus; page?: number; limit?: number}) =>
    api.get<{orders: Order[]} & Page>('/orders', {params}),
  detail: (id: string) => api.get<{order: Order}>('/orders/' + id),
  updateStatus: (
    id: string,
    payload: {status: OrderStatus; tracking_number?: string; carrier?: string},
  ) => api.put<{order: Order}>('/orders/' + id + '/status', payload),
};

export const paymentsApi = {
  placeOrder: (payload: {
    items: {product_id: string; quantity: number}[];
    shipping_address: ShippingAddress;
    notes?: string;
  }) => api.post<{order: Order}>('/payments/place-order', payload),
};

export const returnsApi = {
  list: (params: {status?: ReturnStatus; order_id?: string; page?: number}) =>
    api.get<{returns: ReturnRequest[]} & Page>('/returns', {params}),
  detail: (id: string) => api.get<{return: ReturnRequest}>('/returns/' + id),
  create: (payload: {
    order_id: string;
    reason: string;
    items?: {order_item_id: string; quantity: number; reason?: string}[];
  }) => api.post<{return: ReturnRequest}>('/returns', payload),
  process: (
    id: string,
    payload: {status: ReturnStatus; refund_amount?: number; admin_notes?: string},
  ) => api.put<{return: ReturnRequest}>('/returns/' + id, payload),
};

export const notificationsApi = {
  list: (params: {page?: number; limit?: number} = {}) =>
    api.get<{notifications: AppNotification[]; total: number; unread: number}>(
      '/notifications',
      {params},
    ),
  markRead: (id: string) => api.put('/notifications/' + id + '/read'),
  markAllRead: () => api.put('/notifications/read-all'),
  remove: (id: string) => api.delete('/notifications/' + id),
};

export type TopProduct = {
  id: string;
  name: string;
  price: string;
  units_sold: string;
  revenue: string;
  image: string | null;
};

export type SalesPoint = {date: string; orders: string; revenue: string};

export const dashboardApi = {
  summary: () => api.get<DashboardSummary>('/dashboard/summary'),
  topProducts: () => api.get<{products: TopProduct[]}>('/dashboard/top-products'),
  recentOrders: () => api.get<{orders: Order[]}>('/dashboard/recent-orders'),
  salesChart: () => api.get<{chart: SalesPoint[]}>('/dashboard/sales-chart'),
  pendingShipments: () => api.get<{orders: Order[]}>('/dashboard/pending-shipments'),
};

export const usersApi = {
  list: (params: {role?: string; search?: string; page?: number}) =>
    api.get<{users: User[]} & Page>('/users', {params}),
  detail: (id: string) => api.get<{user: User}>('/users/' + id),
  update: (id: string, payload: Record<string, unknown>) =>
    api.put<{user: User}>('/users/' + id, payload),
  remove: (id: string) => api.delete('/users/' + id),
};
