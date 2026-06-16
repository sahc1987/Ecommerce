import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { ShoppingCart, Store, LogOut, LayoutDashboard, Package, Search, ChevronDown } from 'lucide-react';
import api from '../../api';

export default function ShopLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s: RootState) => s.auth);
  const cartCount = useSelector((s: RootState) =>
    s.cart.items.reduce((sum, i) => sum + i.quantity, 0)
  );
  const [categories, setCategories] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.categories)).catch(() => {});
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(searchQuery.trim() ? `/?search=${encodeURIComponent(searchQuery.trim())}` : '/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-gray-900 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">
            <Link
              to="/"
              onClick={() => setSearchQuery('')}
              className="flex-shrink-0 flex items-center gap-2.5"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-md">
                <Store size={15} className="text-white" />
              </div>
              <span className="font-bold text-xl text-white tracking-tight">ShopHub</span>
            </Link>

            <form onSubmit={handleSearch} className="flex-1 max-w-2xl mx-4">
              <div className="flex rounded overflow-hidden shadow-sm">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="flex-1 bg-white text-gray-900 placeholder-gray-400 px-4 py-2.5 text-sm focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 transition-colors flex items-center gap-1.5 text-sm font-medium flex-shrink-0"
                >
                  <Search size={15} />
                  <span className="hidden sm:inline">Search</span>
                </button>
              </div>
            </form>

            <div className="flex items-center gap-1 flex-shrink-0">
              <Link to="/cart" className="relative p-2.5 text-gray-300 hover:text-white transition-colors">
                <ShoppingCart size={22} />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-sm">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>

              {user ? (
                <div className="flex items-center gap-0.5 ml-1">
                  {['admin', 'staff'].includes(user.role) && (
                    <Link
                      to="/admin"
                      className="hidden sm:flex items-center gap-1.5 text-gray-300 hover:text-white text-sm font-medium px-3 py-2 rounded hover:bg-gray-700 transition-colors"
                    >
                      <LayoutDashboard size={15} />
                      Admin
                    </Link>
                  )}
                  <Link
                    to="/orders"
                    className="hidden sm:flex items-center gap-1.5 text-gray-300 hover:text-white text-sm font-medium px-3 py-2 rounded hover:bg-gray-700 transition-colors"
                  >
                    <Package size={15} />
                    Orders
                  </Link>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white text-xs font-bold ml-2">
                    {user.name[0].toUpperCase()}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 text-gray-400 hover:text-rose-400 hover:bg-gray-800 rounded transition-all"
                    title="Sign out"
                  >
                    <LogOut size={15} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 ml-2">
                  <Link
                    to="/login"
                    className="text-sm text-gray-300 hover:text-white px-3 py-2 hover:bg-gray-700 rounded transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded transition-colors"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {categories.length > 0 && (
          <nav className="bg-gray-800 border-t border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center overflow-x-auto scrollbar-hide">
              <Link
                to="/"
                onClick={() => setSearchQuery('')}
                className="flex-shrink-0 text-gray-300 hover:text-white text-sm font-medium px-4 py-3 hover:bg-gray-700 transition-colors whitespace-nowrap"
              >
                All Products
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/?category=${cat.id}`}
                  className="flex-shrink-0 text-gray-300 hover:text-white text-sm font-medium px-4 py-3 hover:bg-gray-700 transition-colors whitespace-nowrap flex items-center gap-1"
                >
                  {cat.name}
                  <ChevronDown size={11} className="opacity-50" />
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-gray-900 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center">
                <Store size={13} className="text-white" />
              </div>
              <span className="font-bold text-white">ShopHub</span>
            </div>
            <p className="text-sm text-gray-400">
              &copy; {new Date().getFullYear()} ShopHub. All rights reserved.
            </p>
            <div className="flex gap-5 text-sm text-gray-400">
              <button type="button" className="hover:text-white transition-colors">Privacy</button>
              <button type="button" className="hover:text-white transition-colors">Terms</button>
              <button type="button" className="hover:text-white transition-colors">Support</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
