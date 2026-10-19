import { useEffect, useMemo, useState } from 'react';
import { useApiGet } from '../../hooks/useApiGet';
import type { Page } from '../../types';
import { Link, useSearchParams, useNavigate, useOutletContext } from 'react-router-dom';
import {
  ArrowRight, Package, X, Zap, Tag, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Product, hasActiveDiscount } from '../../utils/pricing';
import { categoryIcon } from '../../utils/categoryIcon';
import { textOr } from '../../utils/text';
import { useAddToCart } from '../../hooks/useAddToCart';
import LeftSidebar from '../../components/Shop/LeftSidebar';
import ProductCard from '../../components/Shop/ProductCard';
import type { ShopOutletContext } from '../../components/Layout/ShopLayout';
import ProductImage from '../../components/Shop/ProductImage';

/* ---------- small building blocks ---------- */

function SectionHeader({
  title, subtitle, to, icon, right,
}: Readonly<{ title: string; subtitle?: string; to?: string; icon?: React.ReactNode; right?: React.ReactNode }>) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">{title}{icon}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        {right}
        {to && (
          <Link to={to} className="text-xs font-semibold text-primary-600 hover:text-primary-700 whitespace-nowrap">
            View All
          </Link>
        )}
      </div>
    </div>
  );
}

// 2 columns on phones, 3 on tablets, 4 next to the sidebar, 5 on wide screens.
// Home sections show whole rows only: cards past the row(s) are hidden at
// each width, so a 5-product strip never leaves a lone card on a 4-column row.
const GRID_COLS = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
const ROWS = {
  all: '',
  one: 'max-sm:[&>*:nth-child(n+5)]:hidden sm:max-lg:[&>*:nth-child(n+4)]:hidden lg:max-xl:[&>*:nth-child(n+5)]:hidden',
  two: 'max-lg:[&>*:nth-child(n+7)]:hidden lg:max-xl:[&>*:nth-child(n+9)]:hidden',
};

function ProductGrid({ products, onAddToCart, rows = 'all' }: Readonly<{
  products: Product[]; onAddToCart: (p: Product) => void; rows?: keyof typeof ROWS;
}>) {
  return (
    <div className={`grid ${GRID_COLS} ${ROWS[rows]} gap-3`}>
      {products.map((p) => <ProductCard key={p.id} product={p} onAddToCart={onAddToCart} />)}
    </div>
  );
}

function useCountdown(target: Date | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, (target?.getTime() ?? 0) - now);
  const total = Math.floor(diff / 1000);
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

function Countdown({ target }: Readonly<{ target: Date | null }>) {
  const { hours, minutes, seconds } = useCountdown(target);
  const pad = (n: number) => String(n).padStart(2, '0');
  const cells = [[pad(hours), 'Hrs'], [pad(minutes), 'Min'], [pad(seconds), 'Sec']];
  return (
    <div className="flex items-center gap-1">
      {cells.map(([v, label], i) => (
        <div key={label} className="flex items-center gap-1">
          <div className="text-center">
            <div className="bg-rose-500 text-white text-xs font-bold w-8 h-7 rounded-md flex items-center justify-center tabular-nums">{v}</div>
            <p className="text-[9px] text-slate-500 mt-0.5">{label}</p>
          </div>
          {i < cells.length - 1 && <span className="text-rose-700 font-bold -mt-3">:</span>}
        </div>
      ))}
    </div>
  );
}

function Hero({ products }: Readonly<{ products: Product[] }>) {
  const [idx, setIdx] = useState(0);
  const slides = products.slice(0, 3);
  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [slides.length]);

  const p = slides[idx];
  const discounted = p ? hasActiveDiscount(p) : false;

  return (
    <section className="relative rounded-2xl overflow-hidden bg-linear-to-r from-[#0b1a3d] via-[#0f2c6b] to-primary-600 text-white min-h-70 shadow-lg shadow-primary-900/20">
      <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-primary-400/20 blur-3xl" />
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 p-7 md:p-9 items-center min-h-70">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-primary-200 flex items-center gap-1.5">
            <Zap size={12} /> {textOr(p?.category_name, 'Next-Gen Performance')}
          </p>
          <h1 className="mt-2 text-3xl md:text-4xl font-extrabold leading-tight">
            Power Up<br />your Possibilities
          </h1>
          <p className="mt-3 text-sm text-white/70 max-w-xs line-clamp-2">
            {p ? p.name : 'Laptops, phones and everything in between.'}
          </p>
          <Link
            to={p ? `/products/${p.slug}` : '/'}
            className="mt-5 inline-flex items-center gap-2 bg-white text-primary-700 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-primary-50 transition-colors shadow-md"
          >
            Shop Now <ArrowRight size={15} />
          </Link>
        </div>
        <div className="relative hidden md:flex items-center justify-center h-full min-h-50">
          {discounted && (
            <div className="absolute top-0 right-2 w-16 h-16 rounded-full bg-rose-500 flex flex-col items-center justify-center text-center leading-none shadow-lg rotate-6">
              <span className="text-[9px] font-semibold">Up to</span>
              <span className="text-lg font-extrabold">{Number.parseFloat(p.discount_percent as string).toFixed(0)}%</span>
              <span className="text-[9px] font-semibold">OFF</span>
            </div>
          )}
          {p && (
            <ProductImage
              key={p.id}
              src={p.primary_image}
              alt={p.name}
              category={p.category_name}
              className="w-48 h-48 shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
              priority
            />
          )}
        </div>
      </div>
      {slides.length > 1 && (
        <>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/40'}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIdx((i) => (i - 1 + slides.length) % slides.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center"
            aria-label="Previous slide"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => setIdx((i) => (i + 1) % slides.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center"
            aria-label="Next slide"
          >
            <ChevronRight size={15} />
          </button>
        </>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-24 bg-white rounded-2xl border border-slate-200">
      <div className="w-16 h-16 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-4">
        <Package size={28} className="text-slate-300" />
      </div>
      <p className="text-lg font-semibold text-slate-500">No products found</p>
      <p className="text-sm text-slate-500 mt-1">Try a different search or category</p>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

/* ---------- page ---------- */

function ProductResults({ loading, products, onAddToCart }: Readonly<{
  loading: boolean; products: Product[]; onAddToCart: (p: Product) => void;
}>) {
  if (loading) return <Spinner />;
  if (products.length === 0) return <EmptyState />;
  return <ProductGrid products={products} onAddToCart={onAddToCart} />;
}

// Results per page: fills whole rows at 2, 4 and 5 columns.
const PAGE_SIZE = 20;

export default function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { store, categories, openCart } = useOutletContext<ShopOutletContext>();
  const handleAddToCart = useAddToCart(openCart);

  const urlSearch = searchParams.get('search') ?? '';
  const urlCategory = searchParams.get('category') ?? '';
  const urlDiscount = searchParams.get('discount') === 'true';
  const urlSort = searchParams.get('sort') ?? '';
  const isFiltered = !!(urlSearch || urlCategory || urlDiscount || urlSort);

  // The page number belongs to one set of filters; new filters start on page 1.
  const filterKey = [urlSearch, urlCategory, urlDiscount, urlSort].join('|');
  const [paging, setPaging] = useState({ filterKey, page: 1 });
  const page = paging.filterKey === filterKey ? paging.page : 1;

  const productsQuery = useApiGet<{ products: Product[] } & Page>('/products', {
    page,
    limit: isFiltered ? PAGE_SIZE : 24,
    search: urlSearch || undefined,
    category: urlCategory || undefined,
    discount: urlDiscount ? 'true' : undefined,
    sort: urlSort || undefined,
  });
  const products = useMemo(() => productsQuery.data?.products ?? [], [productsQuery.data]);
  const loading = productsQuery.loading;
  const total = productsQuery.data?.total ?? 0;
  const pages = productsQuery.data?.pages ?? 1;

  // The deals strip is extra: if it fails the page just shows without it.
  const dealsQuery = useApiGet<{ products: Product[] }>('/products', { discount: 'true', limit: 8 });
  const deals = useMemo(() => (dealsQuery.data?.products ?? []).filter(hasActiveDiscount), [dealsQuery.data]);

  // Most-bought first (then newest). Feeds Best Sellers, which only counts
  // products somebody bought, and the "More from the store" row.
  const popularQuery = useApiGet<{ products: Product[] }>('/products', { sort: 'popular', limit: 10 });
  const popular = useMemo(() => popularQuery.data?.products ?? [], [popularQuery.data]);
  const bestSellers = popular.filter((p) => (p.units_sold ?? 0) > 0).slice(0, 5);

  const goToPage = (n: number) => {
    setPaging({ filterKey, page: n });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Merchandising slices for the unfiltered home view. Each section is what its
  // title says: running deals, real best sellers, then the newest products
  // (skipping any already shown above).
  const heroProducts = deals.length ? deals : products;
  const flashSale = deals.slice(0, 5);
  const shownIds = new Set([...flashSale, ...bestSellers].map((p) => p.id));
  const newArrivals = products.filter((p) => !shownIds.has(p.id)).slice(0, 10);
  // A small category or search doesn't fill a row: offer other products under it.
  const resultIds = new Set(products.map((p) => p.id));
  const moreFromStore = !loading && products.length < 5
    ? popular.filter((p) => !resultIds.has(p.id)).slice(0, 5)
    : [];
  // Fallback countdown target, fixed when the page opens.
  const [endOfToday] = useState(() => {
    const eod = new Date();
    eod.setHours(23, 59, 59, 0);
    return eod;
  });
  // The soonest-ending deal. Deals are already filtered to running discounts
  // (hasActiveDiscount), so their end dates are in the future.
  const flashEnd = useMemo(() => {
    const ends = flashSale
      .map((p) => (p.discount_end ? new Date(p.discount_end) : null))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    return ends[0] ?? endOfToday;
  }, [flashSale, endOfToday]);

  const promoCats = categories.slice(0, 2);

  const filteredTitle = (() => {
    if (urlSearch) return `Results for "${urlSearch}"`;
    if (urlCategory) return textOr(categories.find((c) => String(c.id) === urlCategory)?.name, 'Products');
    if (urlDiscount) return 'Deals';
    if (urlSort === 'new') return 'New Arrivals';
    if (urlSort === 'popular') return 'Best Sellers';
    return 'All Products';
  })();

  const renderFiltered = () => (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{filteredTitle}</h1>
          <p className="text-xs text-slate-500">{total} {total === 1 ? 'item' : 'items'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            aria-pressed={urlDiscount}
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              if (urlDiscount) next.delete('discount'); else next.set('discount', 'true');
              navigate(`/?${next.toString()}`);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              urlDiscount ? 'bg-rose-700 text-white border-rose-700' : 'bg-white text-slate-600 border-control hover:border-rose-300'
            }`}
          >
            <Tag size={11} /> On Sale
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-control bg-white text-slate-500 hover:text-slate-900 transition-colors"
          >
            <X size={11} /> Clear
          </button>
        </div>
      </div>

      <ProductResults loading={loading} products={products} onAddToCart={handleAddToCart} />

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-8">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium border border-control bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={page === 1}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">Page {page} of {pages}</span>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium border border-control bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={page === pages}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}

      {moreFromStore.length > 0 && (
        <section className="mt-8">
          <SectionHeader title="More from the store" subtitle="Popular with other shoppers" to="/?sort=popular" />
          <ProductGrid products={moreFromStore} onAddToCart={handleAddToCart} rows="one" />
        </section>
      )}
    </>
  );

  const renderHome = () => {
    if (loading) return <Spinner />;
    if (products.length === 0) return <EmptyState />;
    return (
      <div className="space-y-7">
        <Hero products={heroProducts} />

        {/* Category circles */}
        {categories.length > 0 && (
          <section id="categories" className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
            {categories.map((cat) => {
              const Icon = categoryIcon(cat.name);
              return (
                <Link
                  key={cat.id}
                  to={`/?category=${cat.id}`}
                  className="flex flex-col items-center gap-2 shrink-0 w-22 group"
                >
                  <div className="w-16 h-16 rounded-full bg-white border border-slate-200 flex items-center justify-center overflow-hidden group-hover:border-primary-400 group-hover:shadow-md transition-all">
                    {cat.image_url ? (
                      <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      <Icon size={24} className="text-slate-700 group-hover:text-primary-600 transition-colors" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-slate-700 text-center leading-tight line-clamp-2">{cat.name}</span>
                </Link>
              );
            })}
          </section>
        )}

        {/* Promo tiles */}
        <section className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <Link
            to={promoCats[0] ? `/?category=${promoCats[0].id}` : '/?discount=true'}
            className="sm:col-span-3 rounded-2xl bg-primary-50 border border-primary-100 text-slate-900 p-6 flex items-center justify-between gap-4 min-h-35 hover:shadow-lg hover:border-primary-200 transition-all"
          >
            <div>
              <p className="text-lg font-bold leading-snug">
                Step Into<br />{promoCats[0] ? promoCats[0].name : 'a New Reality'}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-700 bg-white border border-control px-3 py-1.5 rounded-lg">
                Explore Now <ArrowRight size={12} />
              </span>
            </div>
            <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center shrink-0">
              {promoCats[0] ? (() => { const I = categoryIcon(promoCats[0].name); return <I size={40} className="text-primary-600" />; })() : <Zap size={40} className="text-primary-600" />}
            </div>
          </Link>
          <Link
            to={promoCats[1] ? `/?category=${promoCats[1].id}` : '/'}
            className="sm:col-span-2 rounded-2xl bg-white border border-slate-200 p-6 flex items-center justify-between gap-3 min-h-35 hover:shadow-lg hover:border-primary-200 transition-all"
          >
            <div>
              <p className="text-base font-bold text-slate-900 leading-snug">
                {promoCats[1] ? promoCats[1].name : 'Smart Home'}<br />
                <span className="text-primary-600">Smarter Living</span>
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
                Shop Now <ArrowRight size={12} />
              </span>
            </div>
            <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
              {promoCats[1] ? (() => { const I = categoryIcon(promoCats[1].name); return <I size={28} className="text-primary-600" />; })() : <Package size={28} className="text-primary-600" />}
            </div>
          </Link>
        </section>

        {/* Flash sale */}
        {flashSale.length > 0 && (
          <section>
            <SectionHeader
              title="Flash Sale"
              icon={<Zap size={15} className="text-amber-500 fill-amber-400" />}
              subtitle="Limited time deals"
              to="/?discount=true"
              right={<Countdown target={flashEnd} />}
            />
            <ProductGrid products={flashSale} onAddToCart={handleAddToCart} rows="one" />
          </section>
        )}

        {/* Best sellers: ranked by units actually sold; hidden until something sells */}
        {bestSellers.length > 0 && (
          <section>
            <SectionHeader title="Best Sellers" subtitle="Most bought in our store" to="/?sort=popular" />
            <ProductGrid products={bestSellers} onAddToCart={handleAddToCart} rows="one" />
          </section>
        )}

        {/* New arrivals: the newest products not already shown above */}
        {newArrivals.length > 0 && (
          <section>
            <SectionHeader title="New Arrivals" subtitle="Just added to the store" to="/?sort=new" />
            <ProductGrid products={newArrivals} onAddToCart={handleAddToCart} rows="two" />
          </section>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-350 mx-auto px-4 sm:px-6 py-5">
      <div className="flex gap-5 items-start">
        <LeftSidebar categories={categories} store={store} />
        <div className="flex-1 min-w-0">
          {isFiltered ? renderFiltered() : renderHome()}
        </div>
      </div>
    </div>
  );
}

