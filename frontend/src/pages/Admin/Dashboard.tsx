import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DollarSign, ShoppingCart, Users, Package, Clock, RotateCcw, Receipt,
  TrendingUp, TrendingDown, Minus, AlertTriangle, XCircle, Lock, RefreshCw, ArrowRight,
} from 'lucide-react';
import api from '../../api';
import { formatDate } from '../../utils/dates';
import { mediaUrl } from '../../utils/media';
import { textOr } from '../../utils/text';
import SalesChart from '../../components/Admin/SalesChart';

interface Period {
  days: number;
  revenue: number;
  orders: number;
  units: number;
  new_customers: number;
  aov: number;
  previous: { revenue: number; orders: number; units: number; new_customers: number; aov: number };
  change: {
    revenue: number | null; orders: number | null; units: number | null;
    new_customers: number | null; aov: number | null;
  };
}

interface Summary {
  total_revenue: number;
  total_orders: number;
  total_customers: number;
  active_products: number;
  pending_shipments: number;
  pending_returns: number;
  period: Period;
  inventory: {
    low_stock: number; out_of_stock: number;
    low_stock_threshold: number; reserved_units: number;
  };
  status_breakdown: { status: string; count: number; total: number }[];
}

interface TopProduct {
  id: string;
  name: string;
  image: string | null;
  units_sold: number;
  revenue: string;
}

interface RecentOrder {
  id: string;
  customer_name: string | null;
  item_count: number;
  created_at: string;
  total: string;
  status: string;
}

const PERIODS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
  { days: 365, label: '12 months' },
];

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  paid: 'bg-primary-100 text-primary-800',
  processing: 'bg-primary-100 text-primary-800',
  shipped: 'bg-violet-100 text-violet-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-rose-100 text-rose-800',
};

// Same palette as the badges above, for the status distribution bar.
const statusBars: Record<string, string> = {
  pending: 'bg-amber-400',
  paid: 'bg-primary-400',
  processing: 'bg-primary-600',
  shipped: 'bg-violet-500',
  delivered: 'bg-emerald-500',
  cancelled: 'bg-rose-400',
};

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: n >= 1000 ? 0 : 2 });
const exactMoney = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

// "2d ago" reads faster than a date when the list is all recent.
const relativeTime = (iso: string) => {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return formatDate(iso);
};

// A null change means the previous period had no baseline — showing "+100%"
// against zero would be misleading, so we say so instead.
function Delta({ value }: Readonly<{ value: number | null }>) {
  if (value === null) return <span className="text-xs text-slate-400">no prior data</span>;
  if (value === 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
        <Minus size={12} /> 0%
      </span>
    );
  const up = value > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      <Icon size={12} />
      {up ? '+' : ''}{value}%
    </span>
  );
}

function StatCard({
  label, value, sub, icon: Icon, tint, change,
}: Readonly<{
  label: string;
  value: string;
  sub: string;
  icon: typeof DollarSign;
  tint: string;
  change: number | null;
}>) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 ${tint} rounded-xl flex items-center justify-center`}>
          <Icon size={20} />
        </div>
        <Delta value={change} />
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-4 tabular-nums">{value}</p>
      <p className="text-sm text-slate-500 mt-0.5">{label}</p>
      <p className="text-xs text-slate-400 mt-2 border-t border-slate-100 pt-2">{sub}</p>
    </div>
  );
}

const ALERT_TONES = {
  amber: { icon: 'bg-amber-50 text-amber-600', border: 'border-l-amber-400' },
  rose: { icon: 'bg-rose-50 text-rose-600', border: 'border-l-rose-400' },
  orange: { icon: 'bg-orange-50 text-orange-600', border: 'border-l-orange-400' },
  clear: { icon: 'bg-slate-50 text-slate-400', border: 'border-l-slate-200' },
};

function AlertCard({
  to, count, label, hint, icon: Icon, tone,
}: Readonly<{
  to: string;
  count: number;
  label: string;
  hint: string;
  icon: typeof Clock;
  tone: keyof typeof ALERT_TONES;
}>) {
  const active = count > 0;
  const { icon, border } = active ? ALERT_TONES[tone] : ALERT_TONES.clear;
  return (
    <Link to={to} className={`card p-4 border-l-4 ${border} hover:shadow-md transition-shadow group`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${icon}`}>
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-slate-900 leading-tight tabular-nums">{count}</p>
          <p className="text-xs text-slate-500 truncate">{label}</p>
        </div>
        <ArrowRight
          size={16}
          className="ml-auto flex-shrink-0 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all"
        />
      </div>
      <p className="text-xs text-slate-400 mt-2 truncate">{active ? hint : 'Nothing to do here'}</p>
    </Link>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [s, p, o] = await Promise.all([
      api.get(`/dashboard/summary?days=${days}`),
      api.get('/dashboard/top-products'),
      api.get('/dashboard/recent-orders'),
    ]);
    setSummary(s.data);
    setTopProducts(p.data.products);
    setRecentOrders(o.data.orders);
  }, [days]);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    load()
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => { cancelled = true; };
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const period = summary?.period;
  const inv = summary?.inventory;
  const periodLabel = PERIODS.find((p) => p.days === days)?.label ?? `${days} days`;

  const stats = [
    {
      label: `Revenue · last ${periodLabel}`,
      value: money(period?.revenue ?? 0),
      sub: `${exactMoney(summary?.total_revenue ?? 0)} all time`,
      icon: DollarSign,
      tint: 'bg-emerald-50 text-emerald-600',
      change: period?.change.revenue ?? null,
    },
    {
      label: `Orders · last ${periodLabel}`,
      value: String(period?.orders ?? 0),
      sub: `${period?.units ?? 0} units · ${summary?.total_orders ?? 0} orders all time`,
      icon: ShoppingCart,
      tint: 'bg-primary-50 text-primary-600',
      change: period?.change.orders ?? null,
    },
    {
      label: 'Average order value',
      value: money(period?.aov ?? 0),
      sub: `Previously ${money(period?.previous.aov ?? 0)}`,
      icon: Receipt,
      tint: 'bg-violet-50 text-violet-600',
      change: period?.change.aov ?? null,
    },
    {
      label: `New customers · last ${periodLabel}`,
      value: String(period?.new_customers ?? 0),
      sub: `${summary?.total_customers ?? 0} customers total`,
      icon: Users,
      tint: 'bg-orange-50 text-orange-600',
      change: period?.change.new_customers ?? null,
    },
  ];

  const breakdown = (summary?.status_breakdown ?? []).slice().sort((a, b) => b.count - a.count);
  const breakdownTotal = breakdown.reduce((sum, s) => sum + s.count, 0);
  const topRevenue = Math.max(...topProducts.map((p) => Number.parseFloat(p.revenue) || 0), 1);

  return (
    <div className="space-y-6">
      {/* Header + period selector */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            Store performance over the last {periodLabel}, compared with the {periodLabel} before.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-xl p-1">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                  days === p.days ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { setRefreshing(true); load().finally(() => setRefreshing(false)); }}
            className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => <StatCard key={s.label} {...s} />)}
      </div>

      {/* Needs attention */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-700">Needs attention</h2>
          {(inv?.reserved_units ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Lock size={12} />
              {inv?.reserved_units} unit{inv?.reserved_units === 1 ? '' : 's'} held in active carts
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <AlertCard
            to="/admin/orders?status=paid"
            count={summary?.pending_shipments ?? 0}
            label="Pending shipments"
            hint="Paid orders waiting to ship"
            icon={Clock}
            tone="amber"
          />
          <AlertCard
            to="/admin/returns"
            count={summary?.pending_returns ?? 0}
            label="Returns to process"
            hint="Requests awaiting a decision"
            icon={RotateCcw}
            tone="rose"
          />
          <AlertCard
            to="/admin/products"
            count={inv?.low_stock ?? 0}
            label="Low stock"
            hint={`At or below ${inv?.low_stock_threshold ?? 5} units left`}
            icon={AlertTriangle}
            tone="orange"
          />
          <AlertCard
            to="/admin/products"
            count={inv?.out_of_stock ?? 0}
            label="Out of stock"
            hint="Active products with no units"
            icon={XCircle}
            tone="rose"
          />
        </div>
      </div>

      {/* Sales chart */}
      <SalesChart />

      {/* Order status distribution */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-slate-900">Order status</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {breakdownTotal} order{breakdownTotal === 1 ? '' : 's'} placed in the last {periodLabel}
            </p>
          </div>
          <Link to="/admin/orders" className="text-sm text-primary-600 hover:underline">Manage orders</Link>
        </div>
        {breakdownTotal > 0 ? (
          <>
            <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
              {breakdown.map((s) => (
                <div
                  key={s.status}
                  className={statusBars[s.status] ?? 'bg-slate-300'}
                  style={{ width: `${(s.count / breakdownTotal) * 100}%` }}
                  title={`${s.status}: ${s.count}`}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
              {breakdown.map((s) => (
                <Link
                  key={s.status}
                  to={`/admin/orders?status=${s.status}`}
                  className="rounded-xl border border-slate-100 p-3 hover:border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-xs text-slate-500 capitalize">
                    <span className={`w-2 h-2 rounded-full ${statusBars[s.status] ?? 'bg-slate-300'}`} />
                    {s.status}
                  </span>
                  <p className="text-lg font-bold text-slate-900 mt-1 tabular-nums">{s.count}</p>
                  <p className="text-xs text-slate-400 tabular-nums">{money(s.total)}</p>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="text-center text-slate-400 py-8">No orders in this period</p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top products */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-900">Top selling products</h2>
              <p className="text-xs text-slate-500 mt-0.5">By units sold, all time</p>
            </div>
            <Link to="/admin/products" className="text-sm text-primary-600 hover:underline">All products</Link>
          </div>
          {topProducts.some((p) => Number(p.units_sold) > 0) ? (
            <div className="space-y-3">
              {topProducts.slice(0, 5).map((p, i) => {
                const revenue = Number.parseFloat(p.revenue) || 0;
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="w-5 text-sm font-bold text-slate-300 tabular-nums">{i + 1}</span>
                    <div className="w-11 h-11 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {p.image ? (
                        <img src={mediaUrl(p.image)} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package size={18} className="text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{p.name}</p>
                      <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full"
                          style={{ width: `${Math.max((revenue / topRevenue) * 100, 3)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-slate-900 tabular-nums">{money(revenue)}</p>
                      <p className="text-xs text-slate-500 tabular-nums">{p.units_sold} sold</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-slate-400 py-8">No sales yet</p>
          )}
        </div>

        {/* Recent orders */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-slate-900">Recent orders</h2>
              <p className="text-xs text-slate-500 mt-0.5">Newest first, all statuses</p>
            </div>
            <Link to="/admin/orders" className="text-sm text-primary-600 hover:underline">View all</Link>
          </div>
          {recentOrders.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {recentOrders.map((o) => (
                <Link
                  key={o.id}
                  to={`/admin/orders/${o.id}`}
                  className="flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {textOr(o.customer_name, 'G').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{textOr(o.customer_name, 'Guest')}</p>
                    <p className="text-xs text-slate-500 truncate">
                      #{String(o.id).slice(0, 8).toUpperCase()} · {o.item_count} item{Number(o.item_count) === 1 ? '' : 's'} · {relativeTime(o.created_at)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{exactMoney(Number.parseFloat(o.total) || 0)}</p>
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
