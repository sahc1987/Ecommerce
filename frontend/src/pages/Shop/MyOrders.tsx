import { formatDate } from '../../utils/dates';
import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { useApiGet } from "../../hooks/useApiGet";
import type { Order, Page } from "../../types";
import { orderBadge, shortId } from '../../utils/orderDisplay';
import { formatPrice } from '../../utils/pricing';

const statusLabels: Record<string, string> = {
  pending: "Order Placed",
  paid: "Payment Confirmed",
  processing: "Being Prepared",
  shipped: "On the Way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function MyOrders() {
  const { data, loading } = useApiGet<{ orders: Order[] } & Page>("/orders");
  const orders = data?.orders ?? [];

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <ShoppingCart size={48} className="mx-auto mb-4 opacity-40" />
          <p className="text-lg">No orders yet</p>
          <Link to="/" className="mt-4 inline-block btn-primary">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Link
              key={o.id}
              to={`/orders/${o.id}`}
              className="block bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-sm text-slate-500">
                  #{shortId(o.id)}
                </p>
                <span
                  className={`badge ${orderBadge(o.status)}`}
                >
                  {statusLabels[o.status] ?? o.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {o.item_count} item{Number(o.item_count) === 1 ? "" : "s"}
                  </p>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {formatDate(o.created_at)}
                  </p>
                </div>
                <p className="text-xl font-bold text-slate-900">
                  {formatPrice(o.total)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
