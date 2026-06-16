import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export default function OrderSuccess() {
  const [params] = useSearchParams();
  const orderId = params.get('order');

  return (
    <div className="max-w-lg mx-auto px-4 py-24 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <CheckCircle size={40} className="text-green-600" />
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
      <p className="text-gray-500 mb-2">Thank you for your purchase. We've received your order and will process it shortly.</p>
      {orderId && (
        <p className="text-sm text-gray-400 mb-8">
          Order #{orderId.substring(0, 8).toUpperCase()}
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
