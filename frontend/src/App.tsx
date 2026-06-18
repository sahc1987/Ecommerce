import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState } from 'react';
import api from './api';

import ProtectedRoute from './components/ProtectedRoute';
import ShopLayout from './components/Layout/ShopLayout';
import AdminLayout from './components/Layout/AdminLayout';

import SetupWizard from './pages/Setup/SetupWizard';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';

import Dashboard from './pages/Admin/Dashboard';
import ProductList from './pages/Admin/Products/ProductList';
import ProductForm from './pages/Admin/Products/ProductForm';
import CategoriesPage from './pages/Admin/Categories/CategoriesPage';
import OrdersList from './pages/Admin/Orders/OrdersList';
import OrderDetail from './pages/Admin/Orders/OrderDetail';
import ReturnsList from './pages/Admin/Returns/ReturnsList';
import UsersList from './pages/Admin/Users/UsersList';
import StoreSettings from './pages/Admin/Settings/StoreSettings';

import HomePage from './pages/Shop/HomePage';
import ProductDetailPage from './pages/Shop/ProductDetailPage';
import CartPage from './pages/Shop/CartPage';
import CheckoutPage from './pages/Shop/CheckoutPage';
import OrderSuccess from './pages/Shop/OrderSuccess';
import MyOrders from './pages/Shop/MyOrders';
import NotFound from './pages/NotFound';

export default function App() {
  const [setupChecked, setSetupChecked] = useState(false);
  const [isConfigured, setIsConfigured] = useState(true);

  useEffect(() => {
    api.get('/setup/status').then((res) => {
      setIsConfigured(res.data.configured);
      setSetupChecked(true);
    }).catch(() => setSetupChecked(true));
  }, []);

  if (!setupChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
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
    </BrowserRouter>
  );
}
