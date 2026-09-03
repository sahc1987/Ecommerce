import type {NavigatorScreenParams} from '@react-navigation/native';
import type {OrderStatus} from '../types';

export type AuthStackParams = {
  Login: undefined;
  Register: undefined;
};

export type ShopStackParams = {
  Home: undefined;
  ProductDetail: {id: string; name?: string};
};

export type CartStackParams = {
  Cart: undefined;
  Checkout: undefined;
  OrderSuccess: {orderId: string};
};

export type OrdersStackParams = {
  MyOrders: undefined;
  OrderDetail: {id: string};
  RequestReturn: {orderId: string};
  MyReturns: undefined;
};

export type AdminStackParams = {
  Dashboard: undefined;
  AdminProducts: undefined;
  AdminProductForm: {id?: string};
  AdminCategories: undefined;
  AdminOrders: {status?: OrderStatus} | undefined;
  AdminOrderDetail: {id: string};
  AdminReturns: undefined;
  AdminUsers: undefined;
  AdminSettings: undefined;
};

export type MainTabParams = {
  ShopTab: NavigatorScreenParams<ShopStackParams>;
  CartTab: NavigatorScreenParams<CartStackParams>;
  OrdersTab: NavigatorScreenParams<OrdersStackParams>;
  AlertsTab: undefined;
  AccountTab: undefined;
  AdminTab: NavigatorScreenParams<AdminStackParams>;
};
