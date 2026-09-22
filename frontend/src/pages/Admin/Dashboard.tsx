import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign, ShoppingCart, Users, Package, Clock, RotateCcw,
} from 'lucide-react';
import api from '../../api';
import { formatDate } from '../../utils/dates';
import SalesChart from '../../components/Admin/SalesChart';

interface Summary {
  total_revenue: number;
  total_orders: number;
  total_customers: number;
  active_products: number;
  pending_shipments: number;
  pending_returns: number;
}

interface TopProduct {
  id: number;
  name: string;
  image: string | null;
  units_sold: number;
  revenue: string;
}

interface RecentOrder {
  id: number;
  customer_name: string | null;
  item_count: number;
  created_at: string;
  total: string;
  status: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-primary-100 text-primary-800',
  processing: 'bg-primary-100 text-primary-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary'),
      api.get('/dashboard/top-products'),
      api.get('/dashboard/recent-orders'),
    ]).then(([s, p, o]) => {
      setSummary(s.data);
      setTopProducts(p.data.products);
      setRecentOrders(o.data.orders);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const stats = [
    { label: 'Total Revenue', value: `$${summary?.total_revenue.toFixed(2) ?? '0.00'}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total Orders', value: summary?.total_orders ?? 0, icon: ShoppingCart, color: 'text-primary-600', bg: 'bg-primary-50' },
    { label: 'Customers', value: summary?.total_customers ?? 0, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Active Products', value: summary?.active_products ?? 0, icon: Package, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">Welcome back! Here's what's happening.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-5">
            <div className={`w-10 h-10 ${bg} rounded-lg flex items-center justify-center mb-3`}>
              <Icon className={color} size={20} />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-sm text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Alert cards */}
      <div className="grid grid-cols-2 gap-4">
        <Link to="/admin/orders?status=paid" className="card p-5 hover:shadow-md transition-shadow border-l-4 border-l-yellow-400">
          <div className="flex items-center gap-3">
            <Clock className="text-yellow-600" size={20} />
            <div>
              <p className="font-semibold text-slate-900">{summary?.pending_shipments ?? 0}</p>
              <p className="text-sm text-slate-500">Pending Shipments</p>
            </div>
          </div>
        </Link>
        <Link to="/admin/returns" className="card p-5 hover:shadow-md transition-shadow border-l-4 border-l-red-400">
          <div className="flex items-center gap-3">
            <RotateCcw className="text-red-600" size={20} />
            <div>
              <p className="font-semibold text-slate-900">{summary?.pending_returns ?? 0}</p>
              <p className="text-sm text-slate-500">Returns to Process</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Sales chart */}
      <SalesChart />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top products */}
        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-4">Top Selling Products</h2>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.slice(0, 5).map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="w-6 text-sm font-bold text-slate-400">{i + 1}</span>
                  <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                    {p.image ? (
                      <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={20} className="m-auto text-slate-400 mt-2" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.units_sold} units sold</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">${parseFloat(p.revenue).toFixed(2)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-400 py-8">No sales yet</p>
          )}
        </div>

        {/* Recent orders */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">Recent Orders</h2>
            <Link to="/admin/orders" className="text-sm text-primary-600 hover:underline">View all</Link>
          </div>
          {recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((o) => (
                <Link key={o.id} to={`/admin/orders/${o.id}`} className="flex items-center gap-3 hover:bg-slate-50 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{o.customer_name || 'Guest'}</p>
                    <p className="text-xs text-slate-500">{o.item_count} items • {formatDate(o.created_at)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold">${parseFloat(o.total).toFixed(2)}</p>
                    <span className={`badge ${statusColors[o.status] ?? 'bg-slate-100 text-slate-800'}`}>
                      {o.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-slate-400 py-8">No orders yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
