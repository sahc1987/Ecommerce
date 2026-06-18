import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../../store/slices/authSlice';
import { RootState } from '../../store';
import {
  LayoutDashboard, Package, Tag, ShoppingCart, RotateCcw,
  Users, Settings, LogOut, Store, Menu, X, ExternalLink,
} from 'lucide-react';
import { useState } from 'react';
import NotificationBell from '../Notifications/NotificationBell';

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
  readonly user: { name: string; role: string } | null;
  readonly onClose: () => void;
  readonly onLogout: () => void;
}

function Sidebar({ user, onClose, onLogout }: SidebarProps) {
  return (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
          <Store size={15} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-white text-sm leading-tight">ShopHub</p>
          <p className="text-slate-400 text-xs">Admin Panel</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-white/10 hover:text-white'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3 space-y-1">
        <NavLink
          to="/"
          className="flex items-center gap-3 px-3 py-2 text-sm text-slate-400 hover:bg-white/10 hover:text-white rounded-lg transition-all"
        >
          <ExternalLink size={15} />
          View Store
        </NavLink>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {user?.name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={onLogout}
            className="text-slate-500 hover:text-red-400 transition-colors p-1"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((s: RootState) => s.auth);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-60 flex-shrink-0 shadow-xl">
        <Sidebar user={user} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <button
            type="button"
            className="fixed inset-0 w-full bg-black/50 backdrop-blur-sm cursor-default"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
          <aside className="relative flex flex-col w-64 z-10 shadow-2xl">
            <button
              className="absolute top-4 right-4 text-slate-400 hover:text-white z-10"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>
            <Sidebar user={user} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-gray-900"
          >
            <Menu size={20} />
          </button>
          <div className="lg:hidden w-6 h-6 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-md flex items-center justify-center">
            <Store size={12} className="text-white" />
          </div>
          <span className="lg:hidden font-bold text-gray-800">Admin Panel</span>
          <div className="flex-1" />
          <NotificationBell buttonClassName="text-gray-500 hover:text-gray-900" />
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
