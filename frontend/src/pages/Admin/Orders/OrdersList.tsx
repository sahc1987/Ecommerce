import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShoppingCart, Search } from 'lucide-react';
import api from '../../../api';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  processing: 'bg-indigo-100 text-indigo-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const STATUSES = ['', 'pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'];

export default function OrdersList() {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  const fetchOrders = async (p = page, s = status) => {
    setLoading(true);
    try {
      const res = await api.get('/orders', { params: { page: p, limit: 15, status: s || undefined } });
      setOrders(res.data.orders);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(1, status); }, [status]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} orders total</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s || 'all'}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              status === s
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <ShoppingCart size={40} className="mx-auto mb-3 opacity-40" />
            <p>No orders found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Order ID</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500 hidden md:table-cell">Customer</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500 hidden sm:table-cell">Date</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Total</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">
                    #{o.id.substring(0, 8).toUpperCase()}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <p className="font-medium text-gray-900">{o.customer_name || 'Guest'}</p>
                    <p className="text-xs text-gray-400">{o.customer_email}</p>
                  </td>
                  <td className="px-6 py-4 text-gray-500 hidden sm:table-cell">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900">
                    ${parseFloat(o.total).toFixed(2)}
                    <span className="text-xs text-gray-400 font-normal ml-1">({o.item_count} items)</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`badge ${statusColors[o.status] ?? 'bg-gray-100 text-gray-800'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link to={`/admin/orders/${o.id}`} className="text-blue-600 hover:underline text-sm">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button className="btn-secondary py-1.5 px-3 text-sm" disabled={page === 1} onClick={() => { setPage(page - 1); fetchOrders(page - 1); }}>Previous</button>
          <span className="text-sm text-gray-600">Page {page} of {pages}</span>
          <button className="btn-secondary py-1.5 px-3 text-sm" disabled={page === pages} onClick={() => { setPage(page + 1); fetchOrders(page + 1); }}>Next</button>
        </div>
      )}
    </div>
  );
}
