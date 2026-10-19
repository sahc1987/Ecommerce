import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Suspense, lazy, useEffect, useState } from 'react';
import api from './api';
import { setStoreTimeZone } from './utils/dates';
import { mediaUrl } from './utils/media';

import ProtectedRoute from './components/ProtectedRoute';
import ShopLayout from './components/Layout/ShopLayout';

import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';

import HomePage from './pages/Shop/HomePage';
import ProductDetailPage from './pages/Shop/ProductDetailPage';
import CartPage from './pages/Shop/CartPage';
import CheckoutPage from './pages/Shop/CheckoutPage';
import OrderSuccess from './pages/Shop/OrderSuccess';
import MyOrders from './pages/Shop/MyOrders';
import NotFound from './pages/NotFound';

// Back office and setup are loaded on demand, so shoppers don't download them
// (or the charting library the dashboard uses).
const AdminLayout = lazy(() => import('./components/Layout/AdminLayout'));
const SetupWizard = lazy(() => import('./pages/Setup/SetupWizard'));
const Dashboard = lazy(() => import('./pages/Admin/Dashboard'));
const ProductList = lazy(() => import('./pages/Admin/Products/ProductList'));
const ProductForm = lazy(() => import('./pages/Admin/Products/ProductForm'));
const CategoriesPage = lazy(() => import('./pages/Admin/Categories/CategoriesPage'));
const OrdersList = lazy(() => import('./pages/Admin/Orders/OrdersList'));
const OrderDetail = lazy(() => import('./pages/Admin/Orders/OrderDetail'));
const ReturnsList = lazy(() => import('./pages/Admin/Returns/ReturnsList'));
const UsersList = lazy(() => import('./pages/Admin/Users/UsersList'));
const StoreSettings = lazy(() => import('./pages/Admin/Settings/StoreSettings'));

export default function App() {
  const [setupChecked, setSetupChecked] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);

  useEffect(() => {
    api.get('/setup/status').then((res) => {
      setIsConfigured(res.data.configured);
      setStoreTimeZone(res.data.store?.timezone);
      // The tab shows the real store name (index.html only has a generic fallback).
      if (res.data.store?.name) document.title = res.data.store.name;
      const logo = mediaUrl(res.data.store?.logo_url);
      const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (logo && icon) {
        icon.type = '';
        icon.href = logo;
      }
      setSetupChecked(true);
    }).catch(() => setSetupChecked(true));
  }, []);

  if (!setupChecked) return <PageSpinner />;

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
      <Suspense fallback={<PageSpinner />}>
      <Routes>
        {/* Setup wizard (first-time) */}
        <Route
          path="/setup"
          element={
            <ProtectedRoute roles={['admin']}>
              <SetupWizard onComplete={() => setIsConfigured(true)} />
            </ProtectedRoute>
          }
        />

        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Admin */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['admin', 'staff']}>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="products" element={<ProductList />} />
          <Route path="products/new" element={<ProductForm />} />
          <Route path="products/:id/edit" element={<ProductForm />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="orders" element={<OrdersList />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="returns" element={<ReturnsList />} />
          <Route path="users" element={<UsersList />} />
          <Route path="settings" element={<StoreSettings />} />
        </Route>

        {/* Shop */}
        <Route element={<ShopLayout />}>
          <Route
            path="/"
            element={isConfigured ? <HomePage /> : <Navigate to="/setup" replace />}
          />
          <Route path="/products/:slug" element={<ProductDetailPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route
            path="/checkout"
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/order-success"
            element={
              <ProtectedRoute>
                <OrderSuccess />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <MyOrders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders/:id"
            element={
              <ProtectedRoute>
                <OrderDetail isCustomer />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

function PageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
