import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import { RootState } from '../../store';
import api from '../../api';
import {
  LayoutDashboard, Package, Tag, ShoppingCart, RotateCcw,
  Users, Settings, LogOut, Menu, X, ExternalLink, ChevronDown, Headset,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import NotificationBell from '../Notifications/NotificationBell';
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
        <p className="px-3 pt-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
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
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-primary-600'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={15} className={isActive ? 'text-white' : 'text-slate-400'} />
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
        <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
          <ExternalLink size={17} className="text-primary-600" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">View Store</p>
          <p className="text-[11px] text-slate-400">Open the storefront</p>
        </div>
      </NavLink>

      <div className="rounded-2xl bg-gradient-to-br from-[#0b1a3d] via-[#10306e] to-primary-700 p-5 text-white shadow-lg shadow-primary-900/20 mt-auto">
        <div className="flex items-center gap-2 mb-2">
          <Headset size={16} className="text-primary-200" />
          <p className="text-sm font-bold">Need Help?</p>
        </div>
        <p className="text-[11px] text-white/70">Check the README for setup notes and API docs.</p>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s: RootState) => s.auth);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [storeName, setStoreName] = useState('ShopHub');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/setup/status').then((res) => {
      if (res.data.store?.name) setStoreName(res.data.store.name);
      setLogoUrl(res.data.store?.logo_url ?? null);
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

  const firstName = user?.name.split(' ')[0];

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="bg-white sticky top-0 z-40 border-b border-slate-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex items-center gap-3 h-[68px]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-lg"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <NavLink to="/admin" className="flex items-center gap-2.5">
            <StoreLogo logoUrl={logoUrl} name={storeName} size={40} />
            <div className="leading-tight">
              <p className="font-extrabold text-xl text-primary-700 tracking-tight">{storeName}</p>
              <p className="text-[10px] text-slate-400">Admin Panel</p>
            </div>
          </NavLink>

          <div className="flex-1" />

          <NotificationBell buttonClassName="text-slate-500 hover:text-primary-600 hover:bg-slate-100 rounded-lg" />

          <div className="relative ml-1" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-2.5 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 transition-colors"
              aria-label="Account menu"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-bold">
                {user?.name[0].toUpperCase()}
              </div>
              <div className="hidden md:block text-left leading-tight">
                <p className="text-sm font-semibold text-slate-900 truncate max-w-[120px]">Hello, {firstName}</p>
                <p className="text-[11px] text-slate-400 flex items-center gap-0.5 capitalize">{user?.role} <ChevronDown size={11} /></p>
              </div>
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
                  <ExternalLink size={15} className="text-slate-400" /> View Store
                </NavLink>
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
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            className="fixed inset-0 w-full bg-black/40 backdrop-blur-sm cursor-default"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
          <aside className="relative w-64 z-10 bg-slate-100 p-4 overflow-y-auto">
            <button
              className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-700 z-10"
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

      <div className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-5">
        <div className="flex gap-5 items-start">
          <aside className="hidden lg:block w-52 flex-shrink-0 sticky top-[88px]">
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
