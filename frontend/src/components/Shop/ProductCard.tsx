import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import ProductImage from './ProductImage';
import {
  Product, effectivePriceRange, formatPrice, hasActiveDiscount, needsOptions, sellableStock,
} from '../../utils/pricing';

interface Props {
  product: Product;
  onAddToCart: (p: Product) => void;
}

export default function ProductCard({ product: p, onAddToCart }: Readonly<Props>) {
  const { min, max } = effectivePriceRange(p);
  const fromPrice = min !== max; // variants priced differently: "From $X"
  const discounted = hasActiveDiscount(p);
  const stock = sellableStock(p);
  const choose = needsOptions(p);

  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 p-3 group hover:shadow-lg hover:border-primary-200 hover:-translate-y-0.5 transition-all duration-200 flex flex-col">
      {discounted && (
        <span className="absolute top-3 left-3 z-10 bg-rose-700 text-white text-xs font-bold px-1.5 py-0.5 rounded-md">
          {Number.parseFloat(p.discount_percent as string).toFixed(0)}% OFF
        </span>
      )}

      <Link to={`/products/${p.slug}`} className="block">
        <ProductImage
          src={p.primary_image}
          alt={p.name}
          category={p.category_name}
          className="aspect-square w-full"
          imgClassName="group-hover:scale-105 transition-transform duration-300"
        />
      </Link>

      <div className="pt-3 flex-1 flex flex-col">
        <Link to={`/products/${p.slug}`}>
          <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 hover:text-primary-600 transition-colors">
            {p.name}
          </h3>
        </Link>
        {p.category_name && (
          <p className="text-xs text-slate-500 mt-0.5 truncate">{p.category_name}</p>
        )}
        <div className="flex items-end justify-between mt-auto pt-2.5">
          <div className="leading-tight">
            {fromPrice && <span className="text-xs text-slate-500 mr-1">From</span>}
            <span className="font-bold text-slate-900 text-sm">{formatPrice(min)}</span>
            {discounted && !fromPrice && (
              <span className="text-xs text-slate-500 line-through ml-1">
                {formatPrice(p.price_min ?? Number.parseFloat(p.price))}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onAddToCart(p)}
            disabled={stock === 0}
            className="w-9 h-9 shrink-0 rounded-lg border border-control bg-white text-primary-700 flex items-center justify-center hover:bg-primary-600 hover:border-primary-600 hover:text-white active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={choose ? `Choose options for ${p.name}` : `Add ${p.name} to cart`}
          >
            <ShoppingCart size={16} />
          </button>
        </div>
        {stock === 0 && (
          <p className="text-xs text-rose-700 mt-1.5 font-medium">Out of stock</p>
        )}
        {stock > 0 && stock <= 5 && (
          <p className="text-xs text-amber-700 mt-1.5 font-medium">Only {stock} left</p>
        )}
      </div>
    </div>
  );
}
