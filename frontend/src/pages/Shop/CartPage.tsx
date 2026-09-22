import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { ShoppingBag, Trash2, Plus, Minus, ArrowRight, Package } from 'lucide-react';
import { RootState } from '../../store';
import { removeItem, updateQuantity } from '../../store/slices/cartSlice';
import api from '../../api';
import HoldBanner from '../../components/Shop/HoldBanner';
import { lineStatus, useReservations } from '../../hooks/useReservations';

export default function CartPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, reservations, holdStatus } = useSelector((s: RootState) => s.cart);
  const { user } = useSelector((s: RootState) => s.auth);
  const { renew } = useReservations();
  const blocked = items.some((i) => lineStatus(i, reservations[i.product_id], holdStatus) !== 'ok');

  // Opening the cart counts as activity: extend the stock hold.
  useEffect(() => { renew(); }, [renew]);

  const [taxRate, setTaxRate] = useState(0);
  const [taxEnabled, setTaxEnabled] = useState(false);

  useEffect(() => {
    api.get('/setup/status').then((res) => {
      const s = res.data.store;
      if (s?.tax_enabled) {
        setTaxEnabled(true);
        setTaxRate(Number.parseFloat(s.tax_rate) || 0);
      }
    }).catch(() => {});
  }, []);

  const subtotal = items.reduce((sum, i) => sum + i.effective_price * i.quantity, 0);
  const savings = items.reduce((sum, i) => sum + (i.price - i.effective_price) * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const tax = taxEnabled && taxRate > 0 ? Number.parseFloat((subtotal * taxRate / 100).toFixed(2)) : 0;
  const total = subtotal + tax;

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
            const status = lineStatus(item, reservations[item.product_id], holdStatus);
            const held = reservations[item.product_id]?.reserved ?? 0;
            return (
            <div
              key={item.product_id}
              className={`bg-white rounded-2xl border p-4 flex gap-4 transition-colors ${status === 'ok' || status === 'pending' ? 'border-slate-100 hover:border-primary-100' : 'border-rose-200 bg-rose-50/30'}`}
            >
              <div className="w-20 h-20 bg-slate-50 rounded-xl overflow-hidden flex-shrink-0">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package size={24} className="text-slate-300" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{item.name}</p>
                {status === 'unavailable' && <p className="text-xs font-semibold text-rose-600 mt-0.5">Out of stock — reserved by another shopper</p>}
                {status === 'partial' && <p className="text-xs font-semibold text-amber-600 mt-0.5">Only {held} available — reduce quantity to continue</p>}
                {status === 'expired' && <p className="text-xs font-semibold text-amber-600 mt-0.5">Hold expired</p>}
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-bold text-slate-900">${item.effective_price.toFixed(2)}</span>
                  {item.price !== item.effective_price && (
                    <span className="text-xs text-slate-400 line-through">${item.price.toFixed(2)}</span>
                  )}
                </div>

                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg p-0.5">
                    <button
                      onClick={() => dispatch(updateQuantity({ product_id: item.product_id, quantity: item.quantity - 1 }))}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white hover:shadow-sm text-slate-600 transition-all"
                      aria-label="Decrease quantity"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-7 text-center text-sm font-bold">{item.quantity}</span>
                    <button
                      onClick={() => dispatch(updateQuantity({ product_id: item.product_id, quantity: item.quantity + 1 }))}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-white hover:shadow-sm text-slate-600 transition-all"
                      aria-label="Increase quantity"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <button
                    onClick={() => dispatch(removeItem(item.product_id))}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500 transition-colors"
                    aria-label="Remove item"
                  >
                    <Trash2 size={13} />
                    Remove
                  </button>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="font-bold text-slate-900">${(item.effective_price * item.quantity).toFixed(2)}</p>
                {item.price !== item.effective_price && (
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">
                    -{((item.price - item.effective_price) * item.quantity).toFixed(2)} saved
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
                <span className="font-medium text-slate-900">${subtotal.toFixed(2)}</span>
              </div>
              {savings > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Savings</span>
                  <span>-${savings.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span className="text-emerald-600 font-medium">Free</span>
              </div>
              {tax > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Tax ({taxRate}%)</span>
                  <span className="font-medium text-slate-900">${tax.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 mt-4 pt-4 flex justify-between font-bold text-base text-slate-900">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
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
              <p className="text-center text-xs text-rose-500 font-medium mt-3">Fix the highlighted items to continue</p>
            )}
            {savings > 0 && (
              <p className="text-center text-xs text-emerald-600 font-semibold mt-3">
                You're saving ${savings.toFixed(2)} on this order!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
