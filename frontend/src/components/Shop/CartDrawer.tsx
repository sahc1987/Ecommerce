import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { CheckCircle2, Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { RootState } from '../../store';
import { lineKey, removeItem, updateQuantity } from '../../store/slices/cartSlice';
import {
  Product, effectivePriceRange, formatPrice, needsOptions, sellableStock,
} from '../../utils/pricing';
import { useApiGet } from '../../hooks/useApiGet';
import { lineStatus } from '../../hooks/useReservations';
import HoldBanner from './HoldBanner';
import ProductImage from './ProductImage';

interface Props {
  open: boolean;
  /** Key of the line just added, to confirm it at the top. */
  addedKey?: string;
  onClose: () => void;
  onAddToCart: (p: Product) => void;
}

// Slide-out cart, opened from the header icon and after adding a product.
// A native modal <dialog>: focus moves in, the page behind is inert, and
// Escape or a click on the backdrop closes it.
export default function CartDrawer({ open, addedKey, onClose, onAddToCart }: Readonly<Props>) {
  const dispatch = useDispatch();
  const ref = useRef<HTMLDialogElement>(null);
  const { items, reservations, holdStatus } = useSelector((s: RootState) => s.cart);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  // Suggestions are only fetched while the drawer is open.
  const popular = useApiGet<{ products: Product[] }>(open ? '/products' : null, { sort: 'popular', limit: 8 });
  const suggestions = useMemo(
    () => (popular.data?.products ?? [])
      .filter((p) => !items.some((i) => i.product_id === p.id) && sellableStock(p) > 0)
      .slice(0, 3),
    [popular.data, items],
  );

  const added = addedKey ? items.find((i) => lineKey(i) === addedKey) : undefined;
  // Checkout waits for every line's stock hold; only real problems get a note
  // (a hold still being placed just keeps the button disabled for a moment).
  const statuses = items.map((i) => lineStatus(i, reservations[lineKey(i)], holdStatus));
  const blocked = statuses.some((s) => s !== 'ok');
  const problem = statuses.some((s) => s !== 'ok' && s !== 'pending');
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = items.reduce((sum, i) => sum + i.effective_price * i.quantity, 0);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="cart-drawer-title"
      aria-describedby={added ? 'cart-drawer-added' : undefined}
      className="m-0 p-0 w-full h-dvh max-w-none max-h-none bg-transparent backdrop:bg-transparent overflow-hidden"
    >
      {/* Backdrop: a click outside the panel closes it (Escape does too). */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 w-full h-full bg-slate-900/40 cursor-default transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none"
      />
      <div className="absolute inset-y-0 right-0 w-[min(26rem,calc(100vw-2.5rem))] flex flex-col bg-white shadow-2xl transition-transform duration-200 ease-out starting:translate-x-full motion-reduce:transition-none">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200">
          <h2 id="cart-drawer-title" className="text-base font-bold text-slate-900">Your cart ({count})</h2>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="p-2 -mr-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            aria-label="Close cart"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {added && (
            <p id="cart-drawer-added" className="flex items-start gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" />
              <span><span className="font-semibold">Added:</span> {added.name}{added.variant_label ? ` (${added.variant_label})` : ''}</span>
            </p>
          )}

          {items.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart size={28} className="mx-auto text-slate-300 mb-2" aria-hidden="true" />
              <p className="text-sm text-slate-500">Your cart is empty</p>
              <button type="button" onClick={onClose} className="btn-secondary text-sm mt-4">Continue shopping</button>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => {
                const key = lineKey(item);
                const st = lineStatus(item, reservations[key], holdStatus);
                return (
                  <li key={key} className="flex gap-3">
                    <ProductImage src={item.image} alt={item.name} size="thumb" className="w-16 h-16" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">{item.name}</p>
                      {item.variant_label && <p className="text-xs text-slate-500">{item.variant_label}</p>}
                      <p className="text-sm font-bold text-slate-900 mt-0.5">{formatPrice(item.effective_price)}</p>
                      {st === 'needs_option' && <p className="text-xs font-semibold text-amber-700">Choose an option in your cart</p>}
                      {st === 'unavailable' && <p className="text-xs font-semibold text-rose-700">Out of stock</p>}
                      {st === 'partial' && <p className="text-xs font-semibold text-amber-700">Only {reservations[key]?.reserved} available</p>}
                      <div className="flex items-center justify-between mt-1.5">
                        <div className="inline-flex items-center border border-control rounded-lg">
                          <button
                            type="button"
                            onClick={() => dispatch(updateQuantity({ key, quantity: item.quantity - 1 }))}
                            disabled={item.quantity <= 1}
                            className="p-1.5 text-slate-500 hover:text-primary-600 disabled:opacity-30"
                            aria-label={`Decrease quantity of ${item.name}`}
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-semibold w-7 text-center tabular-nums">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => dispatch(updateQuantity({ key, quantity: item.quantity + 1 }))}
                            disabled={item.quantity >= item.stock}
                            className="p-1.5 text-slate-500 hover:text-primary-600 disabled:opacity-30"
                            aria-label={`Increase quantity of ${item.name}`}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => dispatch(removeItem(key))}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                          aria-label={`Remove ${item.name}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <HoldBanner compact />

          {suggestions.length > 0 && (
            <section className="pt-2">
              <h3 className="text-sm font-bold text-slate-900 mb-3">You might also like</h3>
              <ul className="space-y-3">
                {suggestions.map((p) => {
                  const { min, max } = effectivePriceRange(p);
                  return (
                    <li key={p.id} className="flex gap-3 items-center">
                      <Link to={`/products/${p.slug}`} onClick={onClose} tabIndex={-1} aria-hidden="true">
                        <ProductImage src={p.primary_image} alt="" size="thumb" className="w-12 h-12" />
                      </Link>
                      <div className="flex-1 min-w-0">
                        <Link to={`/products/${p.slug}`} onClick={onClose} className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2 hover:text-primary-600">
                          {p.name}
                        </Link>
                        <p className="text-xs font-bold text-slate-900 mt-0.5">
                          {min !== max && <span className="font-normal text-slate-500">From </span>}
                          {formatPrice(min)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onAddToCart(p)}
                        className="w-9 h-9 shrink-0 rounded-lg border border-control bg-white text-primary-700 hover:bg-primary-50 flex items-center justify-center transition-colors"
                        aria-label={needsOptions(p) ? `Choose options for ${p.name}` : `Add ${p.name} to cart`}
                      >
                        <Plus size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-slate-200 px-5 py-4 space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Shipping</span><span className="text-emerald-700 font-medium">Free</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900">
                <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link to="/cart" onClick={onClose} className="btn-secondary text-sm text-center px-3">View cart</Link>
              {blocked ? (
                <button type="button" disabled className="btn-primary text-sm px-3">Checkout</button>
              ) : (
                <Link to="/checkout" onClick={onClose} className="btn-primary text-sm text-center px-3">Checkout</Link>
              )}
            </div>
            {problem && <p className="text-xs text-slate-500 text-center">Fix the items marked above to check out.</p>}
          </div>
        )}
      </div>
    </dialog>
  );
}
