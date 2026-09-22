import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import {
  ShoppingCart, LogOut, LayoutDashboard, Package, Search, ChevronDown, User,
  Facebook, Instagram, Twitter, Youtube,
} from 'lucide-react';
import api from '../../api';
import NotificationBell from '../Notifications/NotificationBell';
import StoreLogo from '../StoreLogo';
import { Category } from '../../utils/pricing';
import { useReservationSync } from '../../hooks/useReservations';

export interface StoreInfo {
  name: string;
  description?: string | null;
  logo_url?: string | null;
}

export interface ShopOutletContext {
  store: StoreInfo;
  categories: Category[];
}

export default function ShopLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s: RootState) => s.auth);
  const cartCount = useSelector((s: RootState) =>
    s.cart.items.reduce((sum, i) => sum + i.quantity, 0)
  );
  const [store, setStore] = useState<StoreInfo>({ name: 'ShopHub' });
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useReservationSync(); // keep server stock holds in step with the cart

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.categories)).catch(() => {});
    api.get('/setup/status').then((res) => {
      if (res.data.store?.name) setStore(res.data.store);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    dispatch(logout());
    navigate('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(searchQuery.trim() ? `/?search=${encodeURIComponent(searchQuery.trim())}` : '/');
  };

  const tagline = store.description?.trim() || 'Upgrade today, smarter tomorrow';
  const year = new Date().getFullYear();
  const firstName = user?.name.split(' ')[0];

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="bg-white sticky top-0 z-40 border-b border-slate-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-6 h-[68px]">
            {/* Logo */}
            <Link
              to="/"
              onClick={() => setSearchQuery('')}
              className="flex-shrink-0 flex items-center gap-2.5"
            >
              <StoreLogo logoUrl={store.logo_url} name={store.name} size={40} />
              <div className="leading-tight">
                <p className="font-extrabold text-xl text-primary-700 tracking-tight">{store.name}</p>
                <p className="text-[10px] text-slate-400 hidden sm:block truncate max-w-[180px]">{tagline}</p>
              </div>
            </Link>

            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500/40 focus-within:border-primary-300 transition-all">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for laptops, phones, accessories..."
                  className="flex-1 min-w-0 bg-transparent text-slate-900 placeholder-slate-400 px-4 py-2.5 text-sm focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-primary-600 hover:bg-primary-700 text-white h-[42px] px-4 sm:px-5 transition-colors flex items-center gap-1.5 text-sm font-semibold flex-shrink-0"
                  aria-label="Search"
                >
                  <Search size={16} />
                </button>
              </div>
            </form>

            {/* Actions */}
            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
              <NotificationBell buttonClassName="text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-lg" />
              <Link
                to="/cart"
                className="relative p-2.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Cart"
              >
                <ShoppingCart size={22} />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-sm">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </Link>

              {user ? (
                <div className="relative ml-1" ref={userMenuRef}>
                  <button
                    onClick={() => setUserMenuOpen((o) => !o)}
                    className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 transition-colors"
                    aria-label="Account menu"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-bold">
                      {user.name[0].toUpperCase()}
                    </div>
                    <div className="hidden md:block text-left leading-tight">
                      <p className="text-sm font-semibold text-slate-900 truncate max-w-[120px]">Hello, {firstName}</p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-0.5">My Account <ChevronDown size={11} /></p>
                    </div>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-semibold text-slate-900 truncate">{user.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{user.role}</p>
                      </div>
                      <Link
                        to="/orders"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Package size={15} className="text-slate-400" /> My Orders
                      </Link>
                      {['admin', 'staff'].includes(user.role) && (
                        <Link
                          to="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <LayoutDashboard size={15} className="text-slate-400" /> Admin Panel
                        </Link>
                      )}
                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-500 hover:bg-rose-50 transition-colors w-full text-left"
                        >
                          <LogOut size={15} /> Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 ml-1">
                  <Link
                    to="/login"
                    className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-primary-600 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <User size={16} />
                    <span className="hidden sm:inline">Sign in</span>
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg transition-colors hidden sm:block"
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Category strip — only on screens without the left sidebar */}
        {categories.length > 0 && (
          <nav className="lg:hidden bg-white border-t border-slate-100">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex items-center overflow-x-auto scrollbar-hide">
              <Link
                to="/"
                onClick={() => setSearchQuery('')}
                className="flex-shrink-0 text-slate-600 hover:text-primary-600 text-sm font-medium px-3 py-2.5 whitespace-nowrap"
              >
                All
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/?category=${cat.id}`}
                  className="flex-shrink-0 text-slate-600 hover:text-primary-600 text-sm font-medium px-3 py-2.5 whitespace-nowrap"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet context={{ store, categories } satisfies ShopOutletContext} />
      </main>

      <footer className="bg-white border-t border-slate-200 mt-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>&copy; {year} {store.name}. All rights reserved.</p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <button type="button" className="hover:text-primary-600 transition-colors">About</button>
              <button type="button" className="hover:text-primary-600 transition-colors">Help</button>
              <button type="button" className="hover:text-primary-600 transition-colors">Privacy</button>
              <button type="button" className="hover:text-primary-600 transition-colors">Terms</button>
              <button type="button" className="hover:text-primary-600 transition-colors">Press</button>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <Facebook size={15} className="hover:text-primary-600 transition-colors cursor-pointer" />
              <Instagram size={15} className="hover:text-primary-600 transition-colors cursor-pointer" />
              <Twitter size={15} className="hover:text-primary-600 transition-colors cursor-pointer" />
              <Youtube size={15} className="hover:text-primary-600 transition-colors cursor-pointer" />
            </div>
            <p className="text-slate-400">Tech for a <span className="text-primary-600 font-semibold">Better Tomorrow</span></p>
          </div>
        </div>
      </footer>
    </div>
  );
}
