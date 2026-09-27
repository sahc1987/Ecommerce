import { Link, useSearchParams } from 'react-router-dom';
import {
  Home, LayoutGrid, Tag, Sparkles, Truck, Headset, ChevronRight, LucideIcon,
} from 'lucide-react';
import { Category } from '../../utils/pricing';
import { categoryIcon } from '../../utils/categoryIcon';

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  match: (params: URLSearchParams) => boolean;
}

const NAV: NavItem[] = [
  { label: 'Home', to: '/', icon: Home, match: (p) => [...p.keys()].length === 0 },
  { label: 'Categories', to: '/#categories', icon: LayoutGrid, match: () => false },
  { label: 'Deals', to: '/?discount=true', icon: Tag, match: (p) => p.get('discount') === 'true' },
  { label: 'New Arrivals', to: '/?sort=new', icon: Sparkles, match: (p) => p.get('sort') === 'new' },
  { label: 'Track Order', to: '/orders', icon: Truck, match: () => false },
];

interface Props {
  categories: Category[];
  storeName: string;
}

export default function LeftSidebar({ categories, storeName }: Readonly<Props>) {
  const [params] = useSearchParams();
  const activeCategory = params.get('category') ?? '';

  return (
    <aside className="hidden lg:flex flex-col gap-4 w-52 flex-shrink-0">
      {/* Main nav */}
      <nav className="bg-white rounded-2xl border border-slate-200 p-2">
        {NAV.map(({ label, to, icon: Icon, match }) => {
          const active = match(params) && !activeCategory;
          return (
            <Link
              key={label}
              to={to}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                active ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-primary-600'
              }`}
            >
              <Icon size={15} className={active ? 'text-white' : 'text-slate-400'} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-2">
          <p className="px-3 pt-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Shop by Category
          </p>
          {categories.map((cat) => {
            const Icon = categoryIcon(cat.name);
            const active = activeCategory === String(cat.id);
            return (
              <Link
                key={cat.id}
                to={active ? '/' : `/?category=${cat.id}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] transition-colors ${
                  active ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-slate-600 hover:bg-slate-50 hover:text-primary-600'
                }`}
              >
                <Icon size={15} className={active ? 'text-primary-600' : 'text-slate-400'} />
                <span className="truncate">{cat.name}</span>
              </Link>
            );
          })}
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-slate-600 hover:bg-slate-50 hover:text-primary-600 transition-colors"
          >
            <ChevronRight size={15} className="text-slate-400" />
            All Products
          </Link>
        </div>
      )}

      {/* Help card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
          <Headset size={18} className="text-primary-600" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">Need Help?</p>
          <p className="text-[11px] text-slate-400">Live chat &middot; 24/7 support</p>
        </div>
      </div>

      {/* Promo card */}
      <Link
        to="/?discount=true"
        className="block rounded-2xl bg-gradient-to-br from-[#0b1a3d] via-[#10306e] to-primary-700 p-5 text-white shadow-lg shadow-primary-900/20 hover:shadow-xl transition-shadow"
      >
        <p className="text-lg font-bold leading-snug">Upgrade Your Tech, Upgrade Your Life</p>
        <p className="text-[11px] text-white/70 mt-2">Exclusive deals at {storeName}</p>
        <span className="inline-block mt-4 text-xs font-semibold bg-white text-primary-700 px-3 py-1.5 rounded-lg">
          Shop Deals
        </span>
      </Link>
    </aside>
  );
}
