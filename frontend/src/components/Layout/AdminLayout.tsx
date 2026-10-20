import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import { RootState } from '../../store';
import api from '../../api';
import {
  LayoutDashboard, Package, Tag, ShoppingCart, RotateCcw,
  Users, Settings, LogOut, Menu, X, ExternalLink, ChevronDown,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import NotificationBell from '../Notifications/NotificationBell';
import { useStoreSettings } from '../../hooks/useStoreSettings';
import StoreLogo from '../StoreLogo';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/products', icon: Package, label: 'Products' },
  { to: '/admin/categories', icon: Tag, label: 'Categories' },
  { to: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/admin/returns', icon: RotateCcw, label: 'Returns' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  readonly onClose: () => void;
}

function Sidebar({ onClose }: SidebarProps) {
  return (
    <div className="flex flex-col gap-4 h-full">
      <nav className="bg-white rounded-2xl border border-slate-200 p-2">
        <p className="px-3 pt-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Manage
        </p>
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-primary-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={15} className={isActive ? 'text-white' : 'text-slate-500'} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <NavLink
        to="/"
        onClick={onClose}
        className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3 hover:border-primary-200 hover:shadow-md transition-all"
      >
        <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
          <ExternalLink size={17} className="text-primary-600" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">View Store</p>
          <p className="text-[11px] text-slate-500">Open the storefront</p>
        </div>
      </NavLink>
    </div>
  );
}

export default function AdminLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s: RootState) => s.auth);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { store } = useStoreSettings();
  const storeName = store?.name ?? '';
  const logoUrl = store?.logo_url ?? null;
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  const firstName = user?.name.split(' ')[0];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white sticky top-0 z-40 border-b border-slate-200 shadow-xs">
        <div className="max-w-350 mx-auto px-4 sm:px-6 flex items-center gap-3 h-17">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-lg"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          {/* Long store names truncate on one line instead of wrapping (as in the shop header). */}
          <NavLink to="/admin" className="min-w-0 flex items-center gap-2.5">
            <StoreLogo logoUrl={logoUrl} name={storeName} size={40} />
            <div className="leading-tight min-w-0">
              <p className="font-extrabold text-lg sm:text-xl text-primary-700 tracking-tight truncate">{storeName}</p>
              <p className="text-[10px] text-slate-500">Admin Panel</p>
            </div>
          </NavLink>

          <div className="flex-1" />

          <NotificationBell buttonClassName="text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-lg" />

          <div className="relative ml-1 shrink-0" ref={userMenuRef}>
            {/* Named by its visible text ("Hello, Saul"), so voice control users
                can say what they see; "Account menu" covers the avatar-only
                phone layout. */}
            <button
              type="button"
              onClick={() => setUserMenuOpen((o) => !o)}
              aria-expanded={userMenuOpen}
              className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <div aria-hidden="true" className="w-9 h-9 rounded-full bg-linear-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-bold">
                {user?.name[0].toUpperCase()}
              </div>
              <div className="hidden md:block text-left leading-tight">
                <p className="text-sm font-semibold text-slate-900 truncate max-w-30">Hello, {firstName}</p>
                <p className="text-[11px] text-slate-500 flex items-center gap-0.5 capitalize">{user?.role} <ChevronDown size={11} aria-hidden="true" /></p>
              </div>
              <span className="sr-only md:hidden">Account menu</span>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">{user?.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{user?.role}</p>
                </div>
                <NavLink
                  to="/"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <ExternalLink size={15} className="text-slate-500" /> View Store
                </NavLink>
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
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            className="fixed inset-0 w-full bg-black/40 backdrop-blur-xs cursor-default"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
          <aside className="relative w-64 z-10 bg-slate-50 p-4 overflow-y-auto">
            <button
              className="absolute top-3 right-3 p-1 text-slate-500 hover:text-slate-700 z-10"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <div className="pt-6 h-full">
              <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>
          </aside>
        </div>
      )}

      <div className="flex-1 max-w-350 w-full mx-auto px-4 sm:px-6 py-5">
        <div className="flex gap-5 items-start">
          <aside className="hidden lg:block w-52 shrink-0 sticky top-22">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </aside>
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
