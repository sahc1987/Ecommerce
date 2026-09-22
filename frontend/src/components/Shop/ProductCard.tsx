import { Link } from 'react-router-dom';
import { Heart, Package, ShoppingCart } from 'lucide-react';
import { Product, formatPrice, getEffectivePrice, hasActiveDiscount, sellableStock } from '../../utils/pricing';

interface Props {
  product: Product;
  onAddToCart: (p: Product) => void;
}

export default function ProductCard({ product: p, onAddToCart }: Readonly<Props>) {
  const price = getEffectivePrice(p);
  const discounted = hasActiveDiscount(p);
  const stock = sellableStock(p);

  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 p-3 group hover:shadow-lg hover:border-primary-200 hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      {discounted && (
        <span className="absolute top-3 left-3 z-10 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
          {Number.parseFloat(p.discount_percent as string).toFixed(0)}% OFF
        </span>
      )}
      <button
        type="button"
        className="absolute top-2.5 right-2.5 z-10 w-7 h-7 rounded-full bg-white/90 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-rose-500 transition-colors"
        aria-label="Add to wishlist"
      >
        <Heart size={13} />
      </button>

      <Link to={`/products/${p.slug}`} className="block">
        <div className="aspect-square rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center">
          {p.primary_image ? (
            <img
              src={p.primary_image}
              alt={p.name}
              className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <Package size={32} className="text-slate-200" />
          )}
        </div>
      </Link>

      <div className="pt-3 flex-1 flex flex-col">
        <Link to={`/products/${p.slug}`}>
          <h3 className="font-semibold text-slate-900 text-xs leading-snug line-clamp-2 hover:text-primary-600 transition-colors">
            {p.name}
          </h3>
        </Link>
        {p.category_name && (
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">{p.category_name}</p>
        )}
        <div className="flex items-end justify-between mt-auto pt-2.5">
          <div className="leading-tight">
            <span className="font-bold text-slate-900 text-sm">{formatPrice(price)}</span>
            {discounted && (
              <span className="text-[10px] text-slate-400 line-through ml-1">
                {formatPrice(Number.parseFloat(p.price))}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onAddToCart(p)}
            disabled={stock === 0}
            className="w-7 h-7 rounded-lg bg-primary-600 text-white flex items-center justify-center hover:bg-primary-700 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={`Add ${p.name} to cart`}
          >
            <ShoppingCart size={13} />
          </button>
        </div>
        {stock === 0 && (
          <p className="text-[10px] text-rose-500 mt-1.5 font-medium">Out of stock</p>
        )}
        {stock > 0 && stock <= 5 && (
          <p className="text-[10px] text-amber-600 mt-1.5 font-medium">Only {stock} left</p>
        )}
      </div>
    </div>
  );
}
