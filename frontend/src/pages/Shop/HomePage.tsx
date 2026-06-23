import { useEffect, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { ShoppingCart, Tag, Package, X } from 'lucide-react';
import api from '../../api';
import { addItem } from '../../store/slices/cartSlice';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: string;
  compare_at_price: string | null;
  stock: number;
  primary_image: string | null;
  discount_active: boolean;
  discount_percent: string | null;
  discount_start: string | null;
  discount_end: string | null;
  category_name: string | null;
}

interface Category {
  id: string;
  name: string;
}

const getEffectivePrice = (p: Product): number => {
  if (!p.discount_active || !p.discount_percent) return Number.parseFloat(p.price);
  const now = new Date();
  if (p.discount_start && new Date(p.discount_start) > now) return Number.parseFloat(p.price);
  if (p.discount_end && new Date(p.discount_end) < now) return Number.parseFloat(p.price);
  return Number.parseFloat(p.price) * (1 - Number.parseFloat(p.discount_percent) / 100);
};

const hasActiveDiscount = (p: Product): boolean => {
  if (!p.discount_active || !p.discount_percent) return false;
  const now = new Date();
  if (p.discount_start && new Date(p.discount_start) > now) return false;
  if (p.discount_end && new Date(p.discount_end) < now) return false;
  return true;
};

function SectionHeader({ title, count }: Readonly<{ title: string; count?: number }>) {
  return (
    <div className="flex items-center justify-between bg-gray-100 border-b border-gray-200 px-3 py-2.5 mb-4">
      <h2 className="text-xs font-bold tracking-widest text-gray-700 uppercase">{title}</h2>
      {count !== undefined && (
        <span className="text-xs text-gray-400">{count} items</span>
      )}
    </div>
  );
}

function ProductCard({ product: p, onAddToCart }: Readonly<{ product: Product; onAddToCart: (p: Product) => void }>) {
  const effectivePrice = getEffectivePrice(p);
  const discounted = hasActiveDiscount(p);

  return (
    <div className="relative bg-white border border-gray-100 overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      {discounted && (
        <div className="absolute top-2 left-2 z-10">
          <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm">
            -{p.discount_percent}%
          </span>
        </div>
      )}
      <Link to={`/products/${p.slug}`} className="block">
        <div className="aspect-square bg-gray-50 overflow-hidden">
          {p.primary_image ? (
            <img
              src={p.primary_image}
              alt={p.name}
              className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package size={32} className="text-gray-200" />
            </div>
          )}
        </div>
      </Link>
      <div className="p-3 border-t border-gray-50">
        <Link to={`/products/${p.slug}`}>
          <h3 className="font-medium text-gray-800 text-xs leading-tight line-clamp-2 hover:text-indigo-600 transition-colors">
            {p.name}
          </h3>
        </Link>
        <div className="flex items-center justify-between mt-2.5">
          <div>
            <span className="font-bold text-gray-900 text-sm">${effectivePrice.toFixed(2)}</span>
            {discounted && (
              <span className="text-[11px] text-gray-400 line-through ml-1">
                ${Number.parseFloat(p.price).toFixed(2)}
              </span>
            )}
          </div>
          <button
            onClick={() => onAddToCart(p)}
            disabled={p.stock === 0}
            className="p-1.5 bg-gray-900 text-white rounded-sm hover:bg-indigo-600 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Add ${p.name} to cart`}
          >
            <ShoppingCart size={13} />
          </button>
        </div>
        {p.stock === 0 && (
          <p className="text-[11px] text-rose-500 mt-1.5 font-medium">Out of stock</p>
        )}
        {p.stock > 0 && p.stock <= 5 && (
          <p className="text-[11px] text-amber-600 mt-1.5 font-medium">Only {p.stock} left</p>
        )}
      </div>
    </div>
  );
}

function FeaturedCard({ product: p, onAddToCart }: Readonly<{ product: Product; onAddToCart: (p: Product) => void }>) {
  const effectivePrice = getEffectivePrice(p);
  const discounted = hasActiveDiscount(p);

  return (
    <div className="bg-white border border-gray-100 overflow-hidden h-full flex flex-col">
      <div className="relative flex-1 bg-gray-50 overflow-hidden min-h-0">
        {discounted && (
          <div className="absolute top-3 left-3 z-10">
            <span className="bg-rose-500 text-white text-sm font-bold px-2 py-1 rounded-sm">
              -{p.discount_percent}%
            </span>
          </div>
        )}
        <Link to={`/products/${p.slug}`} className="block h-full">
          {p.primary_image ? (
            <img
              src={p.primary_image}
              alt={p.name}
              className="w-full h-full object-contain p-4 hover:scale-105 transition-transform duration-300"
              style={{ minHeight: 220 }}
            />
          ) : (
            <div className="w-full h-56 flex items-center justify-center">
              <Package size={56} className="text-gray-200" />
            </div>
          )}
        </Link>
      </div>
      <div className="p-4 border-t border-gray-100">
        <Link to={`/products/${p.slug}`}>
          <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2 hover:text-indigo-600 transition-colors">
            {p.name}
          </h3>
        </Link>
        {p.category_name && (
          <p className="text-xs text-gray-400 mt-0.5">{p.category_name}</p>
        )}
        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            {discounted && (
              <span className="text-xs text-gray-400 line-through block">
                ${Number.parseFloat(p.price).toFixed(2)}
              </span>
            )}
            <span className="text-xl font-bold text-rose-600">${effectivePrice.toFixed(2)}</span>
          </div>
          <button
            onClick={() => onAddToCart(p)}
            disabled={p.stock === 0}
            className="flex items-center gap-1.5 bg-gray-900 hover:bg-indigo-600 text-white text-xs font-semibold px-3 py-2 rounded-sm transition-all disabled:opacity-40 active:scale-95 flex-shrink-0"
          >
            <ShoppingCart size={13} />
            Add to Cart
          </button>
        </div>
        {p.stock === 0 && <p className="text-xs text-rose-500 mt-2 font-medium">Out of stock</p>}
        {p.stock > 0 && p.stock <= 5 && (
          <p className="text-xs text-amber-600 mt-2 font-medium">Only {p.stock} left</p>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-24">
      <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
        <Package size={28} className="text-gray-300" />
      </div>
      <p className="text-lg font-semibold text-gray-500">No products found</p>
      <p className="text-sm text-gray-400 mt-1">Try a different search or category</p>
    </div>
  );
}

export default function HomePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const urlSearch = searchParams.get('search') || '';
  const urlCategory = searchParams.get('category') || '';
  const urlDiscount = searchParams.get('discount') === 'true';
  const isFiltered = !!(urlSearch || urlCategory || urlDiscount);

  const fetchProducts = async (p: number, s: string, cat: string, disc: boolean) => {
    setLoading(true);
    try {
      const res = await api.get('/products', {
        params: {
          page: p,
          limit: 12,
          search: s || undefined,
          category: cat || undefined,
          discount: disc ? 'true' : undefined,
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
    fetchProducts(1, urlSearch, urlCategory, urlDiscount);
  }, [urlSearch, urlCategory, urlDiscount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.categories)).catch(() => {});
  }, []);

  const handleAddToCart = (p: Product) => {
    const effectivePrice = getEffectivePrice(p);
    dispatch(addItem({
      product_id: p.id,
      name: p.name,
      price: Number.parseFloat(p.price),
      effective_price: effectivePrice,
      image: p.primary_image ?? undefined,
      quantity: 1,
      stock: p.stock,
    }));
    toast.success('Added to cart');
  };

  const toggleDiscount = () => {
    const next = new URLSearchParams(searchParams);
    if (urlDiscount) {
      next.delete('discount');
    } else {
      next.set('discount', 'true');
    }
    navigate(`/?${next.toString()}`);
  };

  const clearFilters = () => navigate('/');

  const featuredProduct = isFiltered
    ? null
    : (products.find((p) => hasActiveDiscount(p)) ?? products[0] ?? null);

  const gridProducts = featuredProduct
    ? products.filter((p) => p.id !== featuredProduct.id)
    : products;

  const sectionTitle: string = urlSearch ? `Results for "${urlSearch}"` : (categories.find((c) => String(c.id) === urlCategory)?.name || 'All Products');

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-gray-900 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }
    if (products.length === 0) {
      return <EmptyState />;
    }
    if (featuredProduct) {
      return (
        <div className="flex gap-5">
          <div className="w-60 flex-shrink-0">
            <SectionHeader title="Featured" />
            <FeaturedCard product={featuredProduct} onAddToCart={handleAddToCart} />
          </div>
          <div className="flex-1 min-w-0">
            <SectionHeader title="New Arrivals" count={total} />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {gridProducts.slice(0, 8).map((p) => (
                <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />
              ))}
            </div>
          </div>
        </div>
      );
    }
    return (
      <>
        <SectionHeader title={sectionTitle} count={total} />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />
          ))}
        </div>
      </>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        {categories.map((c) => (
          <Link
            key={c.id}
            to={urlCategory === String(c.id) ? '/' : `/?category=${String(c.id)}`}
            className={`px-3.5 py-1.5 text-xs font-semibold transition-all border ${
              urlCategory === String(c.id)
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-900'
            }`}
          >
            {c.name}
          </Link>
        ))}
        <button
          type="button"
          onClick={toggleDiscount}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold transition-all border ${
            urlDiscount
              ? 'bg-rose-500 text-white border-rose-500'
              : 'bg-white text-gray-600 border-gray-200 hover:border-rose-300'
          }`}
        >
          <Tag size={11} />
          On Sale
        </button>
        {isFiltered && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors ml-1"
          >
            <X size={11} />
            Clear
          </button>
        )}
      </div>

      {renderContent()}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-10">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium border border-gray-300 bg-white rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={page === 1}
            onClick={() => {
              const prev = page - 1;
              setPage(prev);
              fetchProducts(prev, urlSearch, urlCategory, urlDiscount);
            }}
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {pages}</span>
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium border border-gray-300 bg-white rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            disabled={page === pages}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              fetchProducts(next, urlSearch, urlCategory, urlDiscount);
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
