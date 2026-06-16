import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { ShoppingCart, Search, Tag, Package } from 'lucide-react';
import api from '../../api';
import { addItem } from '../../store/slices/cartSlice';

const getEffectivePrice = (p: any) => {
  if (!p.discount_active || !p.discount_percent) return Number.parseFloat(p.price);
  const now = new Date();
  if (p.discount_start && new Date(p.discount_start) > now) return Number.parseFloat(p.price);
  if (p.discount_end && new Date(p.discount_end) < now) return Number.parseFloat(p.price);
  return Number.parseFloat(p.price) * (1 - Number.parseFloat(p.discount_percent) / 100);
};

export default function HomePage() {
  const dispatch = useDispatch();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showDiscount, setShowDiscount] = useState(false);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchProducts = async (p = 1, s = search, cat = selectedCategory, disc = showDiscount) => {
    setLoading(true);
    try {
      const res = await api.get('/products', {
        params: { page: p, limit: 12, search: s || undefined, category: cat || undefined, discount: disc ? 'true' : undefined },
      });
      setProducts(res.data.products);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.categories));
    fetchProducts();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts(1);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setPage(1);
    fetchProducts(1, search, cat, showDiscount);
  };

  const handleDiscountToggle = () => {
    const next = !showDiscount;
    setShowDiscount(next);
    setPage(1);
    fetchProducts(1, search, selectedCategory, next);
  };

  const handleAddToCart = (p: any) => {
    const effectivePrice = getEffectivePrice(p);
    dispatch(addItem({
      product_id: p.id,
      name: p.name,
      price: Number.parseFloat(p.price),
      effective_price: effectivePrice,
      image: p.primary_image,
      quantity: 1,
      stock: p.stock,
    }));
    toast.success('Added to cart');
  };

  const renderProducts = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (products.length === 0) {
      return (
        <div className="text-center py-24">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-gray-300" />
          </div>
          <p className="text-lg font-semibold text-gray-500">No products found</p>
          <p className="text-sm text-gray-400 mt-1">Try a different search or category</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((p) => {
          const effectivePrice = getEffectivePrice(p);
          const hasDiscount = effectivePrice < Number.parseFloat(p.price);
          return (
            <div
              key={p.id}
              className="relative bg-white rounded-2xl border border-gray-100 overflow-hidden group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
            >
              {hasDiscount && (
                <div className="absolute top-2.5 left-2.5 z-10">
                  <span className="bg-rose-500 text-white text-xs font-bold px-2 py-0.5 rounded-lg shadow-sm">
                    -{p.discount_percent}%
                  </span>
                </div>
              )}
              <Link to={`/products/${p.slug}`} className="block">
                <div className="aspect-square bg-slate-50 overflow-hidden">
                  {p.primary_image ? (
                    <img
                      src={p.primary_image}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={36} className="text-gray-200" />
                    </div>
                  )}
                </div>
              </Link>
              <div className="p-3.5">
                <Link to={`/products/${p.slug}`}>
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 hover:text-indigo-600 transition-colors">
                    {p.name}
                  </h3>
                </Link>
                {p.category_name && (
                  <p className="text-xs text-gray-400 mt-0.5">{p.category_name}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <div>
                    <span className="font-bold text-gray-900">${effectivePrice.toFixed(2)}</span>
                    {hasDiscount && (
                      <span className="text-xs text-gray-400 line-through ml-1.5">
                        ${Number.parseFloat(p.price).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleAddToCart(p)}
                    disabled={p.stock === 0}
                    className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    aria-label={`Add ${p.name} to cart`}
                  >
                    <ShoppingCart size={14} />
                  </button>
                </div>
                {p.stock === 0 && (
                  <p className="text-xs text-rose-500 mt-1.5 font-medium">Out of stock</p>
                )}
                {p.stock > 0 && p.stock <= 5 && (
                  <p className="text-xs text-amber-600 mt-1.5 font-medium">Only {p.stock} left</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search + filter hero */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-50 via-violet-50 to-slate-50 border border-indigo-100/60 p-6 mb-8">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">All Products</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} items available</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-10 bg-white shadow-none"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary px-5">Search</button>
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleCategoryChange('')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              selectedCategory === ''
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => handleCategoryChange(String(c.id))}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedCategory === String(c.id)
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'
              }`}
            >
              {c.name}
            </button>
          ))}
          <button
            onClick={handleDiscountToggle}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              showDiscount
                ? 'bg-rose-500 text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-rose-300'
            }`}
          >
            <Tag size={11} />
            On Sale
          </button>
        </div>
      </div>

      {renderProducts()}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-10">
          <button
            className="btn-secondary"
            disabled={page === 1}
            onClick={() => { setPage(page - 1); fetchProducts(page - 1); }}
          >
            Previous
          </button>
          <span className="text-sm text-gray-500 font-medium">Page {page} of {pages}</span>
          <button
            className="btn-secondary"
            disabled={page === pages}
            onClick={() => { setPage(page + 1); fetchProducts(page + 1); }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
