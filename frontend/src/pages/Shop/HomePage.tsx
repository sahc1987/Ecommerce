import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import {
  ArrowRight, Package, X, Zap, Check, Crown, Tag, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '../../api';
import { RootState } from '../../store';
import { addItem } from '../../store/slices/cartSlice';
import { Product, getEffectivePrice, hasActiveDiscount, sellableStock } from '../../utils/pricing';
import { categoryIcon } from '../../utils/categoryIcon';
import { textOr } from '../../utils/text';
import LeftSidebar from '../../components/Shop/LeftSidebar';
import CartSidebar from '../../components/Shop/CartSidebar';
import ProductCard from '../../components/Shop/ProductCard';
import type { ShopOutletContext } from '../../components/Layout/ShopLayout';
import StoreLogo from '../../components/StoreLogo';

/* ---------- small building blocks ---------- */

function SectionHeader({
  title, subtitle, to, icon, right,
}: Readonly<{ title: string; subtitle?: string; to?: string; icon?: React.ReactNode; right?: React.ReactNode }>) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">{title}{icon}</h2>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
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

function ProductGrid({ products, onAddToCart, cols = 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4' }: Readonly<{
  products: Product[]; onAddToCart: (p: Product) => void; cols?: string;
}>) {
  return (
    <div className={`grid ${cols} gap-3`}>
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
            <p className="text-[9px] text-slate-400 mt-0.5">{label}</p>
          </div>
          {i < cells.length - 1 && <span className="text-rose-500 font-bold -mt-3">:</span>}
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
    <section className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[#0b1a3d] via-[#0f2c6b] to-primary-600 text-white min-h-[280px] shadow-lg shadow-primary-900/20">
      <div className="absolute -right-16 -top-16 w-72 h-72 rounded-full bg-primary-400/20 blur-3xl" />
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6 p-7 md:p-9 items-center min-h-[280px]">
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
        <div className="relative hidden md:flex items-center justify-center h-full min-h-[200px]">
          {discounted && (
            <div className="absolute top-0 right-2 w-16 h-16 rounded-full bg-rose-500 flex flex-col items-center justify-center text-center leading-none shadow-lg rotate-6">
              <span className="text-[9px] font-semibold">Up to</span>
              <span className="text-lg font-extrabold">{Number.parseFloat(p.discount_percent as string).toFixed(0)}%</span>
              <span className="text-[9px] font-semibold">OFF</span>
            </div>
          )}
          {p?.primary_image ? (
            <div key={p.id} className="bg-white/90 rounded-2xl p-3 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
              <img
                src={p.primary_image}
                alt={p.name}
                className="max-h-48 w-auto object-contain rounded-xl"
              />
            </div>
          ) : (
            <Package size={96} className="text-white/20" />
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
      <p className="text-sm text-slate-400 mt-1">Try a different search or category</p>
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

export default function HomePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { store, categories } = useOutletContext<ShopOutletContext>();
  const cartItems = useSelector((s: RootState) => s.cart.items);

  const [products, setProducts] = useState<Product[]>([]);
  const [deals, setDeals] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const urlSearch = searchParams.get('search') ?? '';
  const urlCategory = searchParams.get('category') ?? '';
  const urlDiscount = searchParams.get('discount') === 'true';
  const urlSort = searchParams.get('sort') ?? '';
  const isFiltered = !!(urlSearch || urlCategory || urlDiscount || urlSort);

  const fetchProducts = async (p: number) => {
    setLoading(true);
    try {
      const res = await api.get('/products', {
        params: {
          page: p,
          limit: isFiltered ? 12 : 24,
          search: urlSearch || undefined,
          category: urlCategory || undefined,
          discount: urlDiscount ? 'true' : undefined,
        },
      });
      setProducts(res.data.products);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    fetchProducts(1);
  }, [urlSearch, urlCategory, urlDiscount, urlSort]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get('/products', { params: { discount: 'true', limit: 8 } })
      .then((res) => setDeals(res.data.products.filter(hasActiveDiscount)))
      .catch(() => {});
  }, []);

  const handleAddToCart = (p: Product) => {
    dispatch(addItem({
      product_id: p.id,
      name: p.name,
      price: Number.parseFloat(p.price),
      effective_price: getEffectivePrice(p),
      image: p.primary_image ?? undefined,
      quantity: 1,
      stock: p.available_stock ?? p.stock,
    }));
    toast.success('Added to cart');
  };

  const goToPage = (n: number) => {
    setPage(n);
    fetchProducts(n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Merchandising slices for the unfiltered home view
  const heroProducts = deals.length ? deals : products;
  const flashSale = deals.slice(0, 4);
  const dealIds = new Set(flashSale.map((p) => p.id));
  const rest = products.filter((p) => !dealIds.has(p.id));
  const trending = rest.slice(0, 4);
  const recommended = rest.slice(4, 8).length ? rest.slice(4, 8) : rest.slice(0, 4);
  const suggestions = useMemo(
    () => products.filter((p) => !cartItems.some((i) => i.product_id === p.id) && sellableStock(p) > 0).slice(0, 4),
    [products, cartItems]
  );
  const flashEnd = useMemo(() => {
    const ends = flashSale
      .map((p) => (p.discount_end ? new Date(p.discount_end) : null))
      .filter((d): d is Date => !!d && d.getTime() > Date.now())
      .sort((a, b) => a.getTime() - b.getTime());
    if (ends[0]) return ends[0];
    const eod = new Date();
    eod.setHours(23, 59, 59, 0);
    return eod;
  }, [flashSale]);

  const promoCats = categories.slice(0, 2);

  const filteredTitle = (() => {
    if (urlSearch) return `Results for "${urlSearch}"`;
    if (urlCategory) return textOr(categories.find((c) => String(c.id) === urlCategory)?.name, 'Products');
    if (urlDiscount) return 'Deals';
    if (urlSort === 'new') return 'New Arrivals';
    return 'All Products';
  })();

  const renderFiltered = () => (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{filteredTitle}</h1>
          <p className="text-xs text-slate-400">{total} {total === 1 ? 'item' : 'items'}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              if (urlDiscount) next.delete('discount'); else next.set('discount', 'true');
              navigate(`/?${next.toString()}`);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              urlDiscount ? 'bg-rose-500 text-white border-rose-500' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-300'
            }`}
          >
            <Tag size={11} /> On Sale
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 transition-colors"
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
            className="px-4 py-2 text-sm font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={page === 1}
            onClick={() => goToPage(page - 1)}
          >
            Previous
          </button>
          <span className="text-sm text-slate-500">Page {page} of {pages}</span>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium border border-slate-200 bg-white rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={page === pages}
            onClick={() => goToPage(page + 1)}
          >
            Next
          </button>
        </div>
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
                  className="flex flex-col items-center gap-2 flex-shrink-0 w-[88px] group"
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
            className="sm:col-span-3 rounded-2xl bg-gradient-to-r from-[#0b1a3d] to-primary-700 text-white p-6 flex items-center justify-between gap-4 min-h-[140px] hover:shadow-lg transition-shadow"
          >
            <div>
              <p className="text-lg font-bold leading-snug">
                Step Into<br />{promoCats[0] ? promoCats[0].name : 'a New Reality'}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold border border-white/40 px-3 py-1.5 rounded-lg hover:bg-white/10">
                Explore Now <ArrowRight size={12} />
              </span>
            </div>
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
              {promoCats[0] ? (() => { const I = categoryIcon(promoCats[0].name); return <I size={40} className="text-white/80" />; })() : <Zap size={40} className="text-white/80" />}
            </div>
          </Link>
          <Link
            to={promoCats[1] ? `/?category=${promoCats[1].id}` : '/'}
            className="sm:col-span-2 rounded-2xl bg-white border border-slate-200 p-6 flex items-center justify-between gap-3 min-h-[140px] hover:shadow-lg hover:border-primary-200 transition-all"
          >
            <div>
              <p className="text-base font-bold text-slate-900 leading-snug">
                {promoCats[1] ? promoCats[1].name : 'Smart Home'}<br />
                <span className="text-primary-600">Smarter Living</span>
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-600">
                Shop Now <ArrowRight size={12} />
              </span>
            </div>
            <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
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
            <ProductGrid products={flashSale} onAddToCart={handleAddToCart} />
          </section>
        )}

        {/* Trending */}
        {trending.length > 0 && (
          <section>
            <SectionHeader title="Trending Now" subtitle="Most popular tech right now" to="/?sort=new" />
            <ProductGrid products={trending} onAddToCart={handleAddToCart} />
          </section>
        )}

        {/* Recommended */}
        {recommended.length > 0 && (
          <section>
            <SectionHeader title="Recommended for You" subtitle="Based on your browsing history" to="/?sort=new" />
            <ProductGrid products={recommended} onAddToCart={handleAddToCart} />
          </section>
        )}

        {/* Rewards banner */}
        <section className="rounded-2xl bg-[#0b1a3d] text-white p-6 md:p-8 grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-6 items-center">
          <div className="flex items-center gap-3">
            {store.logo_url ? (
              <StoreLogo logoUrl={store.logo_url} name={store.name} size={48} />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-amber-400 flex items-center justify-center">
                <Crown size={22} className="text-[#0b1a3d]" />
              </div>
            )}
            <div className="leading-tight">
              <p className="font-extrabold text-lg">{store.name}</p>
              <p className="text-amber-400 font-bold text-sm tracking-widest">PLUS</p>
            </div>
          </div>
          <div>
            <p className="text-lg font-bold">More Tech. More Rewards.</p>
            <p className="text-xs text-white/60 mt-1 max-w-md">
              Join {store.name} Plus and get exclusive deals, early access, free shipping and more!
            </p>
            <Link
              to="/register"
              className="mt-4 inline-block bg-primary-600 hover:bg-primary-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Join Now
            </Link>
          </div>
          <ul className="space-y-1.5 text-xs text-white/80">
            {['Exclusive Member Prices', 'Early Access to New Launches', 'Free Shipping', 'Special Birthday Offers'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full bg-primary-500 flex items-center justify-center"><Check size={10} /></span>
                {t}
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-5">
      <div className="flex gap-5 items-start">
        <LeftSidebar categories={categories} storeName={store.name} />
        <div className="flex-1 min-w-0">
          {isFiltered ? renderFiltered() : renderHome()}
        </div>
        <CartSidebar suggestions={suggestions} storeName={store.name} onAddToCart={handleAddToCart} />
      </div>
    </div>
  );
}

