import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { ShoppingCart, Store, LogOut, LayoutDashboard, Package } from 'lucide-react';

export default function ShopLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s: RootState) => s.auth);
  const cartCount = useSelector((s: RootState) =>
    s.cart.items.reduce((sum, i) => sum + i.quantity, 0)
  );

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white/90 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2.5 font-bold text-xl">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-sm">
                <Store size={15} className="text-white" />
              </div>
              <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                ShopHub
              </span>
            </Link>

            <div className="flex items-center gap-1">
              <Link
                to="/cart"
                className="relative p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
              >
                <ShoppingCart size={20} />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-indigo-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-sm">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>

              {user ? (
                <div className="flex items-center gap-1 ml-1">
                  {['admin', 'staff'].includes(user.role) && (
                    <Link
                      to="/admin"
                      className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-xl transition-all"
                    >
                      <LayoutDashboard size={15} />
                      <span className="hidden sm:inline">Admin</span>
                    </Link>
                  )}
                  <Link
                    to="/orders"
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 px-3 py-2 rounded-xl transition-all"
                  >
                    <Package size={15} />
                    <span className="hidden sm:inline">Orders</span>
                  </Link>
                  <div className="flex items-center gap-2 pl-2 ml-1 border-l border-gray-100">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {user.name[0].toUpperCase()}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title="Sign out"
                    >
                      <LogOut size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 ml-2">
                  <Link
                    to="/login"
                    className="text-sm font-semibold text-gray-600 hover:text-indigo-600 px-3 py-2 rounded-xl transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link to="/register" className="btn-primary text-sm py-2 px-4">
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-gray-100 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center">
                <Store size={13} className="text-white" />
              </div>
              <span className="font-bold text-gray-800">ShopHub</span>
            </div>
            <p className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} ShopHub. All rights reserved.
            </p>
            <div className="flex gap-5 text-sm text-gray-500">
              <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
              <a href="#" className="hover:text-indigo-600 transition-colors">Terms</a>
              <a href="#" className="hover:text-indigo-600 transition-colors">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
