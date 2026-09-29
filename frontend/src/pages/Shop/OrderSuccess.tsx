import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock, Loader2, XCircle } from 'lucide-react';
import api from '../../api';
import { clearCart } from '../../store/slices/cartSlice';

type PaymentState = 'confirming' | 'paid' | 'processing' | 'failed';

export default function OrderSuccess() {
  const dispatch = useDispatch();
  const [params] = useSearchParams();
  const orderId = params.get('order');
  // Present only when Stripe Checkout sent the customer here.
  const fromStripe = Boolean(params.get('session_id'));
  const [state, setState] = useState<PaymentState>(fromStripe ? 'confirming' : 'paid');

  useEffect(() => {
    if (!fromStripe || !orderId) return;
    let cancelled = false;
    api.post(`/payments/${orderId}/confirm`)
      .then((res) => {
        if (cancelled) return;
        if (res.data.payment_status === 'paid') {
          dispatch(clearCart());
          setState('paid');
        } else if (res.data.status === 'cancelled') {
          setState('failed');
        } else {
          // e.g. a bank transfer still settling; the webhook will finish it.
          dispatch(clearCart());
          setState('processing');
        }
      })
      .catch(() => { if (!cancelled) setState('processing'); });
    return () => { cancelled = true; };
  }, [fromStripe, orderId, dispatch]);

  if (state === 'confirming') {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <Loader2 size={40} className="text-primary-600 animate-spin mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Confirming your payment…</h1>
        <p className="text-slate-500">This only takes a moment.</p>
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div className="max-w-lg mx-auto px-4 py-24 text-center">
        <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle size={40} className="text-rose-600" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Payment not completed</h1>
        <p className="text-slate-500 mb-8">No charge was made. Your cart is still saved, so you can try again.</p>
        <Link to="/checkout" className="btn-primary">Back to checkout</Link>
      </div>
    );
  }

  const processing = state === 'processing';
  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <div className={`w-20 h-20 ${processing ? 'bg-amber-100' : 'bg-green-100'} rounded-full flex items-center justify-center mx-auto mb-6`}>
        {processing ? <Clock size={40} className="text-amber-600" /> : <CheckCircle size={40} className="text-green-600" />}
      </div>
      <h1 className="text-3xl font-bold text-slate-900 mb-2">
        {processing ? 'Payment processing' : 'Order Confirmed!'}
      </h1>
      <p className="text-slate-500 mb-2">
        {processing
          ? "We've received your order and are waiting for the payment to clear. We'll notify you once it does."
          : "Thank you for your purchase. We've received your order and will process it shortly."}
      </p>
      {orderId && (
        <p className="text-sm text-slate-400 mb-8">
          Order #{orderId.slice(0, 8).toUpperCase()}
        </p>
      )}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {orderId && (
          <Link to={`/orders/${orderId}`} className="btn-secondary">
            View Order Details
          </Link>
        )}
        <Link to="/" className="btn-primary">Continue Shopping</Link>
      </div>
    </div>
  );
}
