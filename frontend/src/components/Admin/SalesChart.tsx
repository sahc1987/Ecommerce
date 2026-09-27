import { useEffect, useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { TrendingUp, CalendarRange } from 'lucide-react';
import api, { errorMessage } from '../../api';
import { formatDate, isoDateInStoreZone } from '../../utils/dates';

type Granularity = 'hour' | 'day' | 'week' | 'month';
type Range = 'today' | 'daily' | 'weekly' | 'monthly' | 'custom';
type Metric = 'revenue' | 'orders';

interface Point {
  date: string;   // formatted axis label
  iso: string;    // raw bucket start
  revenue: number;
  orders: number;
}

const RANGES: { key: Range; label: string; granularity: Granularity; days: number }[] = [
  { key: 'today', label: 'Today', granularity: 'hour', days: 1 },
  { key: 'daily', label: 'Daily', granularity: 'day', days: 30 },
  { key: 'weekly', label: 'Weekly', granularity: 'week', days: 7 * 12 },
  { key: 'monthly', label: 'Monthly', granularity: 'month', days: 365 },
  { key: 'custom', label: 'Custom', granularity: 'day', days: 30 },
];

// Calendar-day maths in the store's zone (the API buckets by the same zone).
const toIso = (d: Date) => isoDateInStoreZone(d);
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const money = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

// Custom ranges pick a bucket size that keeps the axis readable.
const autoGranularity = (from: string, to: string): Granularity => {
  const span = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (span > 180) return 'month';
  if (span > 45) return 'week';
  if (span === 0) return 'hour'; // a single day reads best hour by hour
  return 'day';
};

// Hour buckets arrive as YYYY-MM-DDTHH:00 in the store's local time.
const formatHour = (bucket: string) => {
  const h = Number.parseInt(bucket.slice(11, 13), 10);
  return `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;
};

const formatLabel = (bucket: string, g: Granularity) => {
  if (g === 'hour') return formatHour(bucket);
  if (g === 'month') return formatDate(bucket, { month: 'short', year: '2-digit' });
  return formatDate(bucket, { month: 'short', day: 'numeric' });
};

// Compact currency for the Y axis: $950, $1.2k
const axisMoney = (v: number) => {
  const amount = v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);
  return `$${amount}`;
};

const TOOLTIP_PREFIX: Partial<Record<Granularity, string>> = { week: 'Week of ', hour: 'Today, ' };

const orderCount = (n: number) => `${n} ${n === 1 ? 'order' : 'orders'}`;

function ChartTooltip({ active, payload, label, metric, granularity }: any) {
  if (!active || !payload?.length) return null;
  const p: Point = payload[0].payload;
  const prefix = TOOLTIP_PREFIX[granularity as Granularity] ?? '';
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-900">{prefix}{label}</p>
      <p className="text-slate-500 mt-0.5">
        {metric === 'revenue' ? money(p.revenue) : orderCount(p.orders)}
      </p>
    </div>
  );
}

export default function SalesChart() {
  const [range, setRange] = useState<Range>('daily');
  const [metric, setMetric] = useState<Metric>('revenue');
  const [from, setFrom] = useState(toIso(daysAgo(29)));
  const [to, setTo] = useState(toIso(new Date()));
  const [data, setData] = useState<Point[]>([]);
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Resolve the effective query for the active filter.
  const query = useMemo(() => {
    if (range === 'custom') {
      return { from, to, granularity: autoGranularity(from, to) };
    }
    const r = RANGES.find((x) => x.key === range)!;
    return { from: toIso(daysAgo(r.days - 1)), to: toIso(new Date()), granularity: r.granularity };
  }, [range, from, to]);

  useEffect(() => {
    if (query.from > query.to) { setError('Start date must be before end date'); return; }
    setError(null);
    setLoading(true);
    api.get('/dashboard/sales-chart', { params: query })
      .then((res) => {
        const g: Granularity = res.data.granularity;
        setGranularity(g);
        setData(res.data.chart.map((d: { date: string; revenue: string; orders: string }) => ({
          iso: d.date,
          date: formatLabel(d.date, g),
          revenue: Number.parseFloat(d.revenue),
          orders: Number.parseInt(d.orders, 10),
        })));
      })
      .catch((err) => setError(errorMessage(err, 'Failed to load sales data')))
      .finally(() => setLoading(false));
  }, [query]);

  const totals = useMemo(() => ({
    revenue: data.reduce((s, d) => s + d.revenue, 0),
    orders: data.reduce((s, d) => s + d.orders, 0),
  }), [data]);
  const avgOrder = totals.orders ? totals.revenue / totals.orders : 0;
  const hasSales = data.some((d) => d.orders > 0);

  const chipClass = (active: boolean) =>
    `px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
      active ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
    }`;

  const renderChart = () => {
    const overlay = (msg?: string) => (
      <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-xl">
        {msg ? <p className={`text-sm ${error ? 'text-rose-500' : 'text-slate-400'}`}>{msg}</p>
          : <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />}
      </div>
    );
    if (data.length === 0) {
      return (
        <div className="relative h-[260px]">
          {loading ? overlay() : overlay(error ?? 'No sales in this period')}
        </div>
      );
    }

    const common = {
      data,
      margin: { top: 8, right: 8, left: 0, bottom: 0 },
    };
    const axes = (
      <>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          width={56}
          allowDecimals={metric === 'revenue'}
          tickFormatter={(v: number) => (metric === 'revenue' ? axisMoney(v) : String(v))}
        />
        <Tooltip content={<ChartTooltip metric={metric} granularity={granularity} />} cursor={{ stroke: '#cbd5e1' }} />
      </>
    );

    return (
      <div className="relative">
      <ResponsiveContainer width="100%" height={260}>
        {metric === 'revenue' ? (
          <AreaChart {...common}>
            <defs>
              <linearGradient id="salesRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            {axes}
            <Area
              type="linear"
              dataKey="revenue"
              stroke="#2563eb"
              strokeWidth={2}
              fill="url(#salesRevenue)"
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
            />
          </AreaChart>
        ) : (
          <BarChart {...common} barCategoryGap="30%">
            {axes}
            <Bar dataKey="orders" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
          </BarChart>
        )}
      </ResponsiveContainer>
      {loading && overlay()}
      {!loading && error && overlay(error)}
      {!loading && !error && !hasSales && overlay('No sales in this period')}
      </div>
    );
  };

  return (
    <div className="card">
      {/* Header + filters */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center">
            <TrendingUp size={17} className="text-primary-600" />
          </div>
          <div className="leading-tight">
            <h2 className="font-bold text-slate-900">Sales</h2>
            <p className="text-xs text-slate-400">
              {formatDate(query.from, { dateStyle: 'medium' })} – {formatDate(query.to, { dateStyle: 'medium' })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-slate-50 border border-slate-200 rounded-xl p-1">
            {RANGES.map((r) => (
              <button key={r.key} type="button" onClick={() => setRange(r.key)} className={chipClass(range === r.key)}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="inline-flex bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button type="button" onClick={() => setMetric('revenue')} className={chipClass(metric === 'revenue')}>Revenue</button>
            <button type="button" onClick={() => setMetric('orders')} className={chipClass(metric === 'orders')}>Orders</button>
          </div>
        </div>
      </div>

      {range === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
          <CalendarRange size={15} className="text-slate-400" />
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
            className="input !w-auto !py-1.5"
            aria-label="Start date"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={to}
            min={from}
            max={toIso(new Date())}
            onChange={(e) => setTo(e.target.value)}
            className="input !w-auto !py-1.5"
            aria-label="End date"
          />
          <span className="text-xs text-slate-400 ml-1">
            Grouped by {query.granularity}
          </span>
        </div>
      )}

      {/* Range totals */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Revenue', value: money(totals.revenue) },
          { label: 'Orders', value: totals.orders.toLocaleString() },
          { label: 'Avg. order', value: money(avgOrder) },
        ].map((t) => (
          <div key={t.label} className="bg-slate-50 rounded-xl px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t.label}</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5 truncate">{loading ? '—' : t.value}</p>
          </div>
        ))}
      </div>

      {renderChart()}
    </div>
  );
}
