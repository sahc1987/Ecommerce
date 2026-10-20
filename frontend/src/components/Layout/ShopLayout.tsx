import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../../store';
import { logout } from '../../store/slices/authSlice';
import {
  ShoppingCart, LogOut, LayoutDashboard, Package, Search, ChevronDown, User, Mail, Phone,
} from 'lucide-react';
import api from '../../api';
import { textOr } from '../../utils/text';
import NotificationBell from '../Notifications/NotificationBell';
import StoreLogo from '../StoreLogo';
import { Category } from '../../utils/pricing';
import { useReservationSync } from '../../hooks/useReservations';
import { useStoreSettings } from '../../hooks/useStoreSettings';
import type { StoreSettings } from '../../types';
import { useAddToCart } from '../../hooks/useAddToCart';
import CartDrawer from '../Shop/CartDrawer';
import TrustStrip from '../Shop/TrustStrip';

export type StoreInfo = StoreSettings;

// Until the settings load: empty, so no placeholder brand name flashes.
const NO_STORE: StoreInfo = { name: '' };

export interface ShopOutletContext {
  store: StoreInfo;
  categories: Category[];
  /** Opens the cart drawer; pass the key of a line just added to confirm it. */
  openCart: (addedKey?: string) => void;
}

export default function ShopLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  // The drawer belongs to the page it was opened on, so following any link
  // (View cart, Checkout, a suggestion) closes it without an effect.
  const [drawer, setDrawer] = useState<{ locationKey: string; addedKey?: string } | null>(null);
  const drawerOpen = drawer?.locationKey === location.key;
  const openCart = useCallback(
    (addedKey?: string) => setDrawer({ locationKey: location.key, addedKey }),
    [location.key],
  );
  const closeCart = useCallback(() => setDrawer(null), []);
  const addToCart = useAddToCart(openCart);
  const { user } = useSelector((s: RootState) => s.auth);
  const cartCount = useSelector((s: RootState) =>
    s.cart.items.reduce((sum, i) => sum + i.quantity, 0)
  );
  const store = useStoreSettings().store ?? NO_STORE;
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  useReservationSync(); // keep server stock holds in step with the cart

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.categories)).catch(() => {});
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
    try {
      await api.post('/auth/logout');
    } catch {
      // Sign out locally even if the server can't be reached; the cookie expires on its own.
    }
    dispatch(logout());
    navigate('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(searchQuery.trim() ? `/?search=${encodeURIComponent(searchQuery.trim())}` : '/');
  };

  const tagline = textOr(store.description?.trim(), 'Upgrade today, smarter tomorrow');
  const year = new Date().getFullYear();
  const firstName = user?.name.split(' ')[0];
  let cartLabel = 'Cart';
  if (cartCount > 0) cartLabel = `Cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="bg-white sticky top-0 z-40 border-b border-slate-200 shadow-xs">
        <div className="max-w-350 mx-auto px-4 sm:px-6">
          {/* Phones: logo + actions on one row, search full width below it.
              From sm up: a single row. */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 sm:gap-6 py-2.5 sm:py-0 sm:h-17">
            {/* Logo */}
            <Link
              to="/"
              onClick={() => setSearchQuery('')}
              className="min-w-0 sm:shrink-0 flex items-center gap-2.5"
            >
              <StoreLogo logoUrl={store.logo_url} name={store.name} size={40} />
              <div className="leading-tight min-w-0">
                <p className="font-extrabold text-lg sm:text-xl text-primary-700 tracking-tight truncate">{store.name}</p>
                <p className="text-[10px] text-slate-500 hidden sm:block truncate max-w-45">{tagline}</p>
              </div>
            </Link>

            {/* Search */}
            <form onSubmit={handleSearch} className="order-last basis-full min-w-0 sm:order-0 sm:basis-auto sm:flex-1 sm:max-w-2xl">
              <div className="flex items-center rounded-xl border border-control bg-slate-50 overflow-hidden focus-within:ring-2 focus-within:ring-primary-500/40 focus-within:border-primary-600 transition-all">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search laptops, phones and more…"
                  aria-label="Search products"
                  className="flex-1 min-w-0 bg-transparent text-slate-900 placeholder-slate-500 px-4 py-2.5 text-sm focus:outline-hidden"
                />
                <button
                  type="submit"
                  className="bg-primary-600 hover:bg-primary-700 text-white h-10.5 px-4 sm:px-5 transition-colors flex items-center gap-1.5 text-sm font-semibold shrink-0"
                  aria-label="Search"
                >
                  <Search size={16} />
                </button>
              </div>
            </form>

            {/* Actions */}
            <div className="ml-auto sm:ml-0 flex items-center gap-0.5 sm:gap-1 shrink-0">
              <NotificationBell buttonClassName="text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-lg" />
              <button
                type="button"
                onClick={() => openCart()}
                aria-haspopup="dialog"
                className="relative p-2.5 text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label={cartLabel}
              >
                <ShoppingCart size={22} />
                {cartCount > 0 && (
                  <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 bg-primary-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-xs">
                    {cartCount > 9 ? '9+' : cartCount}
                  </span>
                )}
              </button>

              {user ? (
                <div className="relative ml-1" ref={userMenuRef}>
                  {/* Named by its visible text; "Account menu" covers the avatar-only phone layout. */}
                  <button
                    type="button"
                    onClick={() => setUserMenuOpen((o) => !o)}
                    aria-expanded={userMenuOpen}
                    className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <div aria-hidden="true" className="w-9 h-9 rounded-full bg-linear-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-bold">
                      {user.name[0].toUpperCase()}
                    </div>
                    <div className="hidden md:block text-left leading-tight">
                      <p className="text-sm font-semibold text-slate-900 truncate max-w-30">Hello, {firstName}</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-0.5">My Account <ChevronDown size={11} aria-hidden="true" /></p>
                    </div>
                    <span className="sr-only md:hidden">Account menu</span>
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
                        <Package size={15} className="text-slate-500" /> My Orders
                      </Link>
                      {['admin', 'staff'].includes(user.role) && (
                        <Link
                          to="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <LayoutDashboard size={15} className="text-slate-500" /> Admin Panel
                        </Link>
                      )}
                      <div className="border-t border-slate-100 mt-1 pt-1">
                        <button
                          onClick={handleLogout}
                          className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-700 hover:bg-rose-50 transition-colors w-full text-left"
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
                    aria-label="Sign in"
                    className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-primary-600 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <User size={16} />
                    <span className="hidden sm:inline">Sign in</span>
                  </Link>
                  <Link
                    to="/register"
                    className="text-sm font-semibold bg-white border border-control text-primary-700 hover:border-primary-600 hover:bg-primary-50 px-4 py-2 rounded-lg transition-colors hidden sm:block"
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
            <div className="max-w-350 mx-auto px-4 sm:px-6 flex items-center overflow-x-auto scrollbar-hide">
              <Link
                to="/"
                onClick={() => setSearchQuery('')}
                className="shrink-0 text-slate-600 hover:text-primary-600 text-sm font-medium px-3 py-2.5 whitespace-nowrap"
              >
                All
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/?category=${cat.id}`}
                  className="shrink-0 text-slate-600 hover:text-primary-600 text-sm font-medium px-3 py-2.5 whitespace-nowrap"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main id="main" tabIndex={-1} className="flex-1 outline-hidden">
        <Outlet context={{ store, categories, openCart } satisfies ShopOutletContext} />
      </main>

      <CartDrawer open={drawerOpen} addedKey={drawer?.addedKey} onClose={closeCart} onAddToCart={addToCart} />

      <TrustStrip returnDays={store.return_window_days ?? 30} />

      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-350 mx-auto px-4 sm:px-6 py-5">
          {/* Only real links: the store's contact details from Store Settings. */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <p>&copy; {year} {store.name}. All rights reserved.</p>
            {(store.email || store.phone) && (
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
                {store.email && (
                  <a href={`mailto:${store.email}`} className="inline-flex items-center gap-1.5 hover:text-primary-700 transition-colors">
                    <Mail size={13} aria-hidden="true" /> {store.email}
                  </a>
                )}
                {store.phone && (
                  <a href={`tel:${store.phone.replaceAll(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 hover:text-primary-700 transition-colors">
                    <Phone size={13} aria-hidden="true" /> {store.phone}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
