import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect } from 'react';
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight } from 'lucide-react';
import { RootState } from '../../store';
import { lineKey, removeItem, updateQuantity } from '../../store/slices/cartSlice';
import HoldBanner from '../../components/Shop/HoldBanner';
import { lineStatus, useReservations } from '../../hooks/useReservations';
import ProductImage from '../../components/Shop/ProductImage';
import { cartTotals, formatPrice } from '../../utils/pricing';
import type { ShopOutletContext } from '../../components/Layout/ShopLayout';

export default function CartPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { store } = useOutletContext<ShopOutletContext>();
  const { items, reservations, holdStatus } = useSelector((s: RootState) => s.cart);
  const { user } = useSelector((s: RootState) => s.auth);
  const { renew } = useReservations();
  const blocked = items.some((i) => lineStatus(i, reservations[lineKey(i)], holdStatus) !== 'ok');

  // Opening the cart counts as activity: extend the stock hold.
  useEffect(() => { renew(); }, [renew]);

  const { count: itemCount, subtotal, savings, tax, total } = cartTotals(items, store);

  if (items.length === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <ShoppingBag size={36} className="text-primary-300" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Your cart is empty</h1>
        <p className="text-slate-500 mb-7">Add some products to get started</p>
        <Link to="/" className="btn-primary">Browse Products</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Shopping Cart</h1>
      <p className="text-sm text-slate-500 mb-4">{itemCount} {itemCount === 1 ? 'item' : 'items'}</p>
      <div className="mb-6"><HoldBanner /></div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => {
            const status = lineStatus(item, reservations[lineKey(item)], holdStatus);
            const held = reservations[lineKey(item)]?.reserved ?? 0;
            return (
            <div
              key={lineKey(item)}
              className={`bg-white rounded-2xl border p-4 flex gap-4 transition-colors ${status === 'ok' || status === 'pending' ? 'border-slate-100 hover:border-primary-100' : 'border-rose-200 bg-rose-50/30'}`}            >
              <ProductImage src={item.image} alt={item.name} size="thumb" className="w-20 h-20" />

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{item.name}</p>
                {item.variant_label && <p className="text-xs text-slate-500 mt-0.5">{item.variant_label}</p>}
                {status === 'needs_option' && (
                  <p className="text-xs font-semibold text-amber-700 mt-0.5">
                    This product now comes in options —{' '}
                    {item.slug ? <Link to={`/products/${item.slug}`} className="underline">choose one</Link> : 'remove it and add it again'}
                  </p>
                )}
                {status === 'unavailable' && <p className="text-xs font-semibold text-rose-700 mt-0.5">Out of stock — reserved by another shopper</p>}
                {status === 'partial' && <p className="text-xs font-semibold text-amber-700 mt-0.5">Only {held} available — reduce quantity to continue</p>}
                {status === 'expired' && <p className="text-xs font-semibold text-amber-700 mt-0.5">Hold expired</p>}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-bold text-slate-900">{formatPrice(item.effective_price)}</span>
                  {item.price !== item.effective_price && (
                    <span className="text-xs text-slate-500 line-through">{formatPrice(item.price)}</span>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg p-0.5">
                    <button
                      onClick={() => dispatch(updateQuantity({ key: lineKey(item), quantity: item.quantity - 1 }))}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white hover:shadow-xs text-slate-600 transition-all"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-7 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      onClick={() => dispatch(updateQuantity({ key: lineKey(item), quantity: item.quantity + 1 }))}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white hover:shadow-xs text-slate-600 transition-all"
                      aria-label="Increase quantity"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    onClick={() => dispatch(removeItem(lineKey(item)))}
                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-500 transition-colors"
                    aria-label="Remove item"
                  >
                    <Trash2 size={13} />
                    Remove
                  </button>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="font-bold text-slate-900">{formatPrice(item.effective_price * item.quantity)}</p>
                {item.price !== item.effective_price && (
                  <p className="text-xs text-emerald-700 font-medium mt-0.5">
                    -{formatPrice((item.price - item.effective_price) * item.quantity)} saved
                  </p>
                )}
              </div>
            </div>
            );
          })}

          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium mt-2">
            ← Continue Shopping
          </Link>
        </div>

        {/* Summary */}
        <div>
          <div className="card sticky top-24">
            <h2 className="font-bold text-slate-900 text-lg mb-5">Order Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal ({itemCount} {itemCount === 1 ? 'item' : 'items'})</span>
                <span className="font-medium text-slate-900">{formatPrice(subtotal)}</span>
              </div>
              {savings > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Savings</span>
                  <span>-{formatPrice(savings)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span className="text-emerald-700 font-medium">Free</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Tax ({Number(store.tax_rate)}%)</span>
                  <span className="font-medium text-slate-900">{formatPrice(tax)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 mt-4 pt-4 flex justify-between font-bold text-base text-slate-900">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </div>

            <button
              onClick={() => navigate(user ? '/checkout' : '/login')}
              disabled={blocked}
              className="btn-primary w-full mt-5 flex items-center justify-center gap-2 py-3"
            >
              {user ? 'Proceed to Checkout' : 'Sign in to Checkout'}
              <ArrowRight size={16} />
            </button>

            {blocked && (
              <p className="text-center text-xs text-rose-700 font-medium mt-3">Fix the highlighted items to continue</p>
            )}
            {savings > 0 && (
              <p className="text-center text-xs text-emerald-700 font-semibold mt-3">
                You're saving {formatPrice(savings)} on this order!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
