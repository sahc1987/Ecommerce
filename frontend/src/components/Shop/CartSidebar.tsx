import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  ArrowRight, Minus, Plus, ShoppingCart, Package, Trash2, ShieldCheck, Truck, RotateCcw, Lock,
} from 'lucide-react';
import { RootState } from '../../store';
import { removeItem, updateQuantity } from '../../store/slices/cartSlice';
import { Product, formatPrice, getEffectivePrice, hasActiveDiscount, sellableStock } from '../../utils/pricing';
import HoldBanner from './HoldBanner';
import { lineStatus } from '../../hooks/useReservations';

const PERKS = [
  { icon: ShieldCheck, title: '100% Authentic Products', text: 'Direct from trusted brands' },
  { icon: Truck, title: 'Free & Fast Shipping', text: 'On orders over $50' },
  { icon: RotateCcw, title: 'Easy Returns', text: 'Hassle-free return window' },
  { icon: Lock, title: 'Secure Payments', text: 'Your data is always safe' },
];

interface Props {
  suggestions: Product[];
  storeName: string;
  onAddToCart: (p: Product) => void;
}

function Thumb({ src, alt, size = 'w-14 h-14' }: Readonly<{ src?: string | null; alt: string; size?: string }>) {
  return (
    <div className={`${size} rounded-lg bg-slate-50 border border-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center`}>
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-contain p-1" />
      ) : (
        <Package size={18} className="text-slate-300" />
      )}
    </div>
  );
}

export default function CartSidebar({ suggestions, storeName, onAddToCart }: Readonly<Props>) {
  const dispatch = useDispatch();
  const { items, reservations, holdStatus } = useSelector((s: RootState) => s.cart);
  const blocked = items.some((i) => lineStatus(i, reservations[i.product_id], holdStatus) !== 'ok');
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.effective_price * i.quantity, 0);

  return (
    <aside className="hidden xl:flex flex-col gap-4 w-64 flex-shrink-0">
      {/* Cart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-3">My Cart ({count})</h3>

        {items.length === 0 ? (
          <div className="text-center py-6">
            <ShoppingCart size={26} className="mx-auto text-slate-200 mb-2" />
            <p className="text-xs text-slate-400">Your cart is empty</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {items.map((item) => (
              <div key={item.product_id} className="flex gap-3">
                <Thumb src={item.image} alt={item.name} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2">{item.name}</p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">{formatPrice(item.effective_price)}</p>
                  {(() => {
                    const st = lineStatus(item, reservations[item.product_id], holdStatus);
                    if (st === 'unavailable') return <p className="text-[10px] font-semibold text-rose-500">Out of stock</p>;
                    if (st === 'partial') return <p className="text-[10px] font-semibold text-amber-600">Only {reservations[item.product_id]?.reserved} available</p>;
                    return null;
                  })()}
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="inline-flex items-center border border-slate-200 rounded-md">
                      <button
                        type="button"
                        onClick={() => dispatch(updateQuantity({ product_id: item.product_id, quantity: item.quantity - 1 }))}
                        disabled={item.quantity <= 1}
                        className="p-1 text-slate-500 hover:text-primary-600 disabled:opacity-30"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="text-[11px] font-semibold w-6 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => dispatch(updateQuantity({ product_id: item.product_id, quantity: item.quantity + 1 }))}
                        disabled={item.quantity >= item.stock}
                        className="p-1 text-slate-500 hover:text-primary-600 disabled:opacity-30"
                        aria-label="Increase quantity"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => dispatch(removeItem(item.product_id))}
                      className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && <div className="mt-3"><HoldBanner compact /></div>}

        <div className="border-t border-slate-100 mt-4 pt-3 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span><span className="text-slate-900 font-medium">{formatPrice(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Shipping</span><span className="text-emerald-600 font-medium">Free</span>
          </div>
          <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-100">
            <span>Total</span><span>{formatPrice(subtotal)}</span>
          </div>
        </div>

        <Link
          to={items.length && !blocked ? '/checkout' : '/cart'}
          className={`mt-3 flex items-center justify-center gap-1.5 w-full text-xs font-semibold py-2.5 rounded-xl transition-colors ${
            items.length && !blocked
              ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
              : 'bg-slate-100 text-slate-400 pointer-events-none'
          }`}
        >
          Checkout Now <ArrowRight size={13} />
        </Link>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-900 mb-3">You Might Also Like</h3>
          <div className="space-y-3">
            {suggestions.map((p) => {
              const price = getEffectivePrice(p);
              const discounted = hasActiveDiscount(p);
              return (
                <div key={p.id} className="flex gap-3 items-center">
                  <Link to={`/products/${p.slug}`}>
                    <Thumb src={p.primary_image} alt={p.name} size="w-12 h-12" />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link to={`/products/${p.slug}`} className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2 hover:text-primary-600">
                      {p.name}
                    </Link>
                    {p.category_name && <p className="text-[10px] text-slate-400 truncate">{p.category_name}</p>}
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs font-bold text-slate-900">
                        {formatPrice(price)}
                        {discounted && (
                          <span className="ml-1 text-[10px] text-slate-400 line-through font-normal">
                            {formatPrice(Number.parseFloat(p.price))}
                          </span>
                        )}
                      </p>
                      <button
                        type="button"
                        onClick={() => onAddToCart(p)}
                        disabled={sellableStock(p) === 0}
                        className="w-6 h-6 rounded-md bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center disabled:opacity-30 transition-colors"
                        aria-label={`Add ${p.name} to cart`}
                      >
                        <ShoppingCart size={11} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Perks */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-3">Why Shop with {storeName}?</h3>
        <div className="space-y-3">
          {PERKS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Icon size={16} className="text-primary-600" />
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-slate-900">{title}</p>
                <p className="text-[10px] text-slate-400">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
