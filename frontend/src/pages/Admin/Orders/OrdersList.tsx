import { useState } from "react";
import { formatDate } from '../../../utils/dates';
import { textOr } from '../../../utils/text';
import { Link, useSearchParams } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import ListContent from '../../../components/Admin/ListContent';
import { useApiGet } from '../../../hooks/useApiGet';
import type { Order, Page } from '../../../types';
import { orderBadge, shortId } from '../../../utils/orderDisplay';
import { formatPrice } from '../../../utils/pricing';
import Pagination from '../../../components/Pagination';

const STATUSES = [
  "",
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

export default function OrdersList() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "");
  const [page, setPage] = useState(1);
  const { data, loading } = useApiGet<{ orders: Order[] } & Page>("/orders", {
    page,
    limit: 15,
    status: status || undefined,
  });
  const orders = data?.orders ?? [];
  const total = data?.total ?? 0;
  const pages = data?.pages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} orders total</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s || "all"}
            aria-pressed={status === s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              status === s
                ? "bg-primary-600 text-white"
                : "bg-white border border-control text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <ListContent loading={loading} isEmpty={orders.length === 0} emptyIcon={ShoppingCart} emptyText="No orders found">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-slate-500">
                  Order ID
                </th>
                <th className="text-left px-6 py-3 font-medium text-slate-500 hidden md:table-cell">
                  Customer
                </th>
                <th className="text-left px-6 py-3 font-medium text-slate-500 hidden sm:table-cell">
                  Date
                </th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">
                  Total
                </th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">
                  Status
                </th>
                <th className="relative px-6 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    #{shortId(o.id)}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <p className="font-medium text-slate-900">
                      {textOr(o.customer_name, "Guest")}
                    </p>
                    <p className="text-xs text-slate-500">{o.customer_email}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-500 hidden sm:table-cell">
                    {formatDate(o.created_at)}
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-900">
                    {formatPrice(o.total)}
                    <span className="text-xs text-slate-500 font-normal ml-1">
                      ({o.item_count} items)
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`badge ${orderBadge(o.status)}`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/admin/orders/${o.id}`}
                      className="text-primary-600 hover:underline text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListContent>
      </div>

      <Pagination page={page} pages={pages} onChange={setPage} />
    </div>
  );
}
