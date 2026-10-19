import { Link, useSearchParams } from 'react-router-dom';
import {
  Home, LayoutGrid, Tag, Sparkles, Truck, Headset, ChevronRight, LucideIcon,
} from 'lucide-react';
import { Category } from '../../utils/pricing';
import type { StoreInfo } from '../Layout/ShopLayout';
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
  store: StoreInfo;
}

export default function LeftSidebar({ categories, store }: Readonly<Props>) {
  const [params] = useSearchParams();
  const activeCategory = params.get('category') ?? '';

  return (
    // Sticky below the header, scrolling on its own if the category list is long.
    <aside className="hidden lg:flex flex-col gap-4 w-52 shrink-0 sticky top-21 max-h-[calc(100dvh-6rem)] overflow-y-auto scrollbar-thin">
      {/* Main nav */}
      <nav className="bg-white rounded-2xl border border-slate-200 p-2">
        {NAV.map(({ label, to, icon: Icon, match }) => {
          const active = match(params) && !activeCategory;
          return (
            <Link
              key={label}
              to={to}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-colors ${
                active ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50 hover:text-primary-600'
              }`}
            >
              <Icon size={15} className={active ? 'text-white' : 'text-slate-500'} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Categories */}
      {categories.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-2">
          <p className="px-3 pt-1 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
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
                <Icon size={15} className={active ? 'text-primary-600' : 'text-slate-500'} />
                <span className="truncate">{cat.name}</span>
              </Link>
            );
          })}
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] text-slate-600 hover:bg-slate-50 hover:text-primary-600 transition-colors"
          >
            <ChevronRight size={15} className="text-slate-500" />
            All Products
          </Link>
        </div>
      )}

      {/* Help card: the store's real contact details (Store Settings); hidden
          until at least one is filled in. */}
      {(store.email || store.phone) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
            <Headset size={18} className="text-primary-600" aria-hidden="true" />
          </div>
          <div className="leading-tight min-w-0">
            <p className="text-sm font-semibold text-slate-900">Need help?</p>
            {store.email && (
              <a href={`mailto:${store.email}`} className="block text-xs text-primary-700 hover:underline truncate mt-0.5">
                {store.email}
              </a>
            )}
            {store.phone && (
              <a href={`tel:${store.phone.replaceAll(/[^\d+]/g, '')}`} className="block text-xs text-primary-700 hover:underline mt-0.5">
                {store.phone}
              </a>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
