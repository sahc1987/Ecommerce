import React, {useEffect} from 'react';
import {NavigationContainer, DefaultTheme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {colors, font} from '../theme';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {bootstrapAuth, sessionExpired} from '../store/slices/authSlice';
import {hydrateCart, cartCount} from '../store/slices/cartSlice';
import {loadStoreSettings} from '../store/slices/settingsSlice';
import {setUnauthorizedHandler} from '../api/client';
import {clearToken} from '../utils/storage';
import {Loading} from '../components/ui';
import {useUnreadCount} from '../hooks/useUnreadCount';

import LoginScreen from '../screens/Auth/LoginScreen';
import RegisterScreen from '../screens/Auth/RegisterScreen';
import HomeScreen from '../screens/Shop/HomeScreen';
import ProductDetailScreen from '../screens/Shop/ProductDetailScreen';
import CartScreen from '../screens/Shop/CartScreen';
import CheckoutScreen from '../screens/Shop/CheckoutScreen';
import OrderSuccessScreen from '../screens/Shop/OrderSuccessScreen';
import MyOrdersScreen from '../screens/Shop/MyOrdersScreen';
import OrderDetailScreen from '../screens/Shop/OrderDetailScreen';
import RequestReturnScreen from '../screens/Shop/RequestReturnScreen';
import MyReturnsScreen from '../screens/Shop/MyReturnsScreen';
import NotificationsScreen from '../screens/Shop/NotificationsScreen';
import ProfileScreen from '../screens/Shop/ProfileScreen';

import DashboardScreen from '../screens/Admin/DashboardScreen';
import AdminProductsScreen from '../screens/Admin/AdminProductsScreen';
import AdminProductFormScreen from '../screens/Admin/AdminProductFormScreen';
import AdminCategoriesScreen from '../screens/Admin/AdminCategoriesScreen';
import AdminOrdersScreen from '../screens/Admin/AdminOrdersScreen';
import AdminOrderDetailScreen from '../screens/Admin/AdminOrderDetailScreen';
import AdminReturnsScreen from '../screens/Admin/AdminReturnsScreen';
import AdminUsersScreen from '../screens/Admin/AdminUsersScreen';
import AdminSettingsScreen from '../screens/Admin/AdminSettingsScreen';

import type {
  AdminStackParams,
  AuthStackParams,
  CartStackParams,
  MainTabParams,
  OrdersStackParams,
  ShopStackParams,
} from './types';

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

const screenOptions = {
  headerStyle: {backgroundColor: colors.surface},
  headerTitleStyle: {fontSize: font.lg, fontWeight: '700' as const, color: colors.text},
  headerTintColor: colors.primary,
  contentStyle: {backgroundColor: colors.bg},
};

/* ------------------------------------------------------------------ Auth */

const AuthStack = createNativeStackNavigator<AuthStackParams>();

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{...screenOptions, headerShown: false}}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Register" component={RegisterScreen} />
  </AuthStack.Navigator>
);

/* ------------------------------------------------------------------ Shop */

const ShopStack = createNativeStackNavigator<ShopStackParams>();

const ShopNavigator = () => (
  <ShopStack.Navigator screenOptions={screenOptions}>
    <ShopStack.Screen
      name="Home"
      component={HomeScreen}
      options={{title: 'Shop'}}
    />
    <ShopStack.Screen
      name="ProductDetail"
      component={ProductDetailScreen}
      options={({route}) => ({title: route.params.name ?? 'Product'})}
    />
  </ShopStack.Navigator>
);

const CartStack = createNativeStackNavigator<CartStackParams>();

const CartNavigator = () => (
  <CartStack.Navigator screenOptions={screenOptions}>
    <CartStack.Screen name="Cart" component={CartScreen} options={{title: 'Cart'}} />
    <CartStack.Screen
      name="Checkout"
      component={CheckoutScreen}
      options={{title: 'Checkout'}}
    />
    <CartStack.Screen
      name="OrderSuccess"
      component={OrderSuccessScreen}
      options={{title: 'Order placed', headerBackVisible: false}}
    />
  </CartStack.Navigator>
);

const OrdersStack = createNativeStackNavigator<OrdersStackParams>();

const OrdersNavigator = () => (
  <OrdersStack.Navigator screenOptions={screenOptions}>
    <OrdersStack.Screen
      name="MyOrders"
      component={MyOrdersScreen}
      options={{title: 'My orders'}}
    />
    <OrdersStack.Screen
      name="OrderDetail"
      component={OrderDetailScreen}
      options={{title: 'Order'}}
    />
    <OrdersStack.Screen
      name="RequestReturn"
      component={RequestReturnScreen}
      options={{title: 'Request a return'}}
    />
    <OrdersStack.Screen
      name="MyReturns"
      component={MyReturnsScreen}
      options={{title: 'My returns'}}
    />
  </OrdersStack.Navigator>
);

/* ----------------------------------------------------------------- Admin */

const AdminStack = createNativeStackNavigator<AdminStackParams>();

const AdminNavigator = () => (
  <AdminStack.Navigator screenOptions={screenOptions}>
    <AdminStack.Screen
      name="Dashboard"
      component={DashboardScreen}
      options={{title: 'Dashboard'}}
    />
    <AdminStack.Screen
      name="AdminProducts"
      component={AdminProductsScreen}
      options={{title: 'Products'}}
    />
    <AdminStack.Screen
      name="AdminProductForm"
      component={AdminProductFormScreen}
      options={({route}) => ({
        title: route.params?.id ? 'Edit product' : 'New product',
      })}
    />
    <AdminStack.Screen
      name="AdminCategories"
      component={AdminCategoriesScreen}
      options={{title: 'Categories'}}
    />
    <AdminStack.Screen
      name="AdminOrders"
      component={AdminOrdersScreen}
      options={{title: 'Orders'}}
    />
    <AdminStack.Screen
      name="AdminOrderDetail"
      component={AdminOrderDetailScreen}
      options={{title: 'Order'}}
    />
    <AdminStack.Screen
      name="AdminReturns"
      component={AdminReturnsScreen}
      options={{title: 'Returns'}}
    />
    <AdminStack.Screen
      name="AdminUsers"
      component={AdminUsersScreen}
      options={{title: 'Customers'}}
    />
    <AdminStack.Screen
      name="AdminSettings"
      component={AdminSettingsScreen}
      options={{title: 'Store settings'}}
    />
  </AdminStack.Navigator>
);

/* ------------------------------------------------------------------ Tabs */

const Tabs = createBottomTabNavigator<MainTabParams>();

const MainNavigator = () => {
  const items = useAppSelector(s => s.cart.items);
  const role = useAppSelector(s => s.auth.user?.role);
  const unread = useUnreadCount();
  const count = cartCount(items);
  const isStaff = role === 'admin' || role === 'staff';

  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {backgroundColor: colors.surface, borderTopColor: colors.border},
        tabBarLabelStyle: {fontSize: font.xs, fontWeight: '600'},
      }}>
      <Tabs.Screen
        name="ShopTab"
        component={ShopNavigator}
        options={{
          title: 'Shop',
          tabBarIcon: ({color, size}) => (
            <Icon name="storefront-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="CartTab"
        component={CartNavigator}
        options={{
          title: 'Cart',
          tabBarBadge: count > 0 ? count : undefined,
          tabBarIcon: ({color, size}) => (
            <Icon name="cart-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="OrdersTab"
        component={OrdersNavigator}
        options={{
          title: 'Orders',
          tabBarIcon: ({color, size}) => (
            <Icon name="package-variant-closed" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="AlertsTab"
        component={NotificationsScreen}
        options={{
          title: 'Alerts',
          headerShown: true,
          ...screenOptions,
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarIcon: ({color, size}) => (
            <Icon name="bell-outline" color={color} size={size} />
          ),
        }}
      />
      {isStaff ? (
        <Tabs.Screen
          name="AdminTab"
          component={AdminNavigator}
          options={{
            title: 'Admin',
            tabBarIcon: ({color, size}) => (
              <Icon name="view-dashboard-outline" color={color} size={size} />
            ),
          }}
        />
      ) : null}
      <Tabs.Screen
        name="AccountTab"
        component={ProfileScreen}
        options={{
          title: 'Account',
          headerShown: true,
          ...screenOptions,
          tabBarIcon: ({color, size}) => (
            <Icon name="account-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs.Navigator>
  );
};

/* ------------------------------------------------------------------ Root */

const RootNavigator = () => {
  const dispatch = useAppDispatch();
  const {user, booting} = useAppSelector(s => s.auth);

  useEffect(() => {
    // A 401 anywhere means the stored token is dead — drop it and fall back to
    // the auth stack rather than leaving the user on a broken screen.
    setUnauthorizedHandler(() => {
      void clearToken();
      dispatch(sessionExpired());
    });
    void dispatch(bootstrapAuth());
    void dispatch(hydrateCart());
    void dispatch(loadStoreSettings());
    return () => setUnauthorizedHandler(null);
  }, [dispatch]);

  if (booting) {
    return <Loading label="Loading store…" />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      {user ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

export default RootNavigator;
