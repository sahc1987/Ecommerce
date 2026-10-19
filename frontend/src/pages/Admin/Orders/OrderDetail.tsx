import { Fragment, useEffect, useState } from "react";
import { formatDateTime } from '../../../utils/dates';
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Check, ExternalLink, Package, RotateCcw, Truck } from "lucide-react";
import { isAxiosError } from "axios";
import api, { errorMessage } from "../../../api";
import type { Order, OrderStatus, ReturnRequest } from "../../../types";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-primary-100 text-primary-800",
  processing: "bg-primary-100 text-primary-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const returnStatusColors: Record<string, string> = {
  requested: "bg-yellow-100 text-yellow-800",
  approved: "bg-primary-100 text-primary-800",
  rejected: "bg-red-100 text-red-800",
  refunded: "bg-green-100 text-green-800",
};

const STEPS = [
  { label: 'Order Placed', reach: ['pending', 'paid', 'processing', 'shipped', 'delivered'] },
  { label: 'Processing',   reach: ['paid', 'processing', 'shipped', 'delivered'] },
  { label: 'Shipped',      reach: ['shipped', 'delivered'] },
  { label: 'Delivered',    reach: ['delivered'] },
];

function getTrackingUrl(carrier: string, trackingNumber: string): string {
  const c = carrier.toLowerCase();
  if (c.includes('ups'))   return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
  if (c.includes('fedex')) return `https://www.fedex.com/apps/fedextrack/?tracknumbers=${encodeURIComponent(trackingNumber)}`;
  if (c.includes('usps'))  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
  if (c.includes('dhl'))   return `https://www.dhl.com/us-en/home/tracking/tracking-freight.html?submit=1&tracking-id=${encodeURIComponent(trackingNumber)}`;
  return `https://parcelsapp.com/en/tracking/${encodeURIComponent(trackingNumber)}`;
}

const paymentBadge: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-800',
  unpaid: 'bg-amber-100 text-amber-800',
  canceled: 'bg-rose-100 text-rose-800',
  refunded: 'bg-slate-200 text-slate-800',
  partially_refunded: 'bg-sky-100 text-sky-800',
};

const paymentLabel = (s?: string) => (s ?? 'unpaid').replace('_', ' ');

// A paid card order is refunded in full when cancelled.
const refundOnCancel = (order: Order) =>
  order.payment_method === 'stripe' &&
  (order.payment_status === 'paid' || order.payment_status === 'partially_refunded');

const cancelPrompt = (order: Order, byCustomer: boolean) => {
  const refund = refundOnCancel(order)
    ? ` The ${byCustomer ? 'payment' : 'customer'} will be refunded to the card.`
    : '';
  return `Cancel this order? This cannot be undone.${refund}`;
};

interface Props {
  isCustomer?: boolean;
}

export default function OrderDetail({ isCustomer }: Readonly<Props>) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showShipModal, setShowShipModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [returnRequest, setReturnRequest] = useState<ReturnRequest | null>(null);
  const [returnWindowDays, setReturnWindowDays] = useState(30);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  useEffect(() => {
    // Ignore responses for an order we've navigated away from.
    let ignore = false;
    const loads: Promise<unknown>[] = [
      api.get<{ order: Order }>(`/orders/${id}`).then((res) => {
        if (!ignore) setOrder(res.data.order);
      }),
    ];
    if (isCustomer) {
      loads.push(
        api.get('/setup/status').then((res) => {
          if (!ignore) setReturnWindowDays(res.data.store?.return_window_days ?? 30);
        }),
        api.get<{ returns: ReturnRequest[] }>('/returns', { params: { order_id: id, limit: 1 } }).then((res) => {
          if (!ignore) setReturnRequest(res.data.returns[0] ?? null);
        }),
      );
    }
    Promise.allSettled(loads).then(() => {
      if (!ignore) setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [id, isCustomer]);

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReturn(true);
    try {
      const res = await api.post('/returns', { order_id: id, reason: returnReason });
      setReturnRequest(res.data.return);
      setShowReturnForm(false);
      setReturnReason('');
      toast.success('Return request submitted');
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to submit return request'));
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Status responses don't include the items; keep the ones already loaded.
  const mergeOrder = (next: Order) =>
    setOrder((prev) => (prev ? { ...prev, ...next, items: prev.items } : next));

  // The server rejects changes that aren't allowed or were overtaken by
  // another change (409, with the current order): show that order instead.
  const handleUpdateError = (err: unknown) => {
    toast.error(errorMessage(err, "Update failed"));
    if (isAxiosError<{ order?: Order }>(err) && err.response?.status === 409 && err.response.data.order)
      mergeOrder(err.response.data.order);
  };

  const updateStatus = async (current: Order, body: Record<string, unknown>, success: string) => {
    setUpdatingStatus(true);
    try {
      // expected_status: refuse if the order changed since this page loaded.
      const res = await api.put<{ order: Order }>(`/orders/${id}/status`, { ...body, expected_status: current.status });
      mergeOrder(res.data.order);
      toast.success(success);
      return true;
    } catch (err) {
      handleUpdateError(err);
      return false;
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleStatusChange = async (status: OrderStatus) => {
    if (!order) return;
    if (status === 'shipped') {
      setTrackingNumber(order.tracking_number ?? '');
      setCarrier(order.carrier ?? '');
      setShowShipModal(true);
      return;
    }
    if (status === 'cancelled' && !globalThis.confirm(cancelPrompt(order, false))) return;
    await updateStatus(order, { status }, status === 'cancelled' ? 'Order cancelled' : 'Status updated');
  };

  const handleShipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    const ok = await updateStatus(
      order,
      { status: 'shipped', tracking_number: trackingNumber, carrier },
      'Order marked as shipped',
    );
    if (ok) setShowShipModal(false);
  };

  // Customer cancel: allowed until the store starts preparing the order.
  const handleCustomerCancel = async () => {
    if (!order || !globalThis.confirm(cancelPrompt(order, true))) return;
    setUpdatingStatus(true);
    try {
      const res = await api.post<{ order: Order }>(`/orders/${id}/cancel`);
      mergeOrder(res.data.order);
      toast.success(refundOnCancel(order) ? 'Order cancelled — your refund is on its way' : 'Order cancelled');
    } catch (err) {
      handleUpdateError(err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (!order)
    return <p className="text-center text-slate-500 py-16">Order not found</p>;

  const addr = order.shipping_address;
  const hasTracking = Boolean(order.tracking_number) || Boolean(order.carrier);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(isCustomer ? "/orders" : "/admin/orders")}
          className="text-slate-400 hover:text-slate-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Order #{order.id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Placed {formatDateTime(order.created_at)}
          </p>
        </div>
        <span
          className={`badge ${statusColors[order.status] ?? "bg-slate-100 text-slate-800"} ml-auto text-sm px-3 py-1`}
        >
          {order.status}
        </span>
      </div>

      {/* Shipment progress (customer view, non-cancelled) */}
      {isCustomer && order.status !== 'cancelled' && (
        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-5">Order Progress</h2>
          <div className="flex items-center">
            {STEPS.map((step, i) => {
              const done = step.reach.includes(order.status);
              const lineActive = i < STEPS.length - 1 && STEPS[i + 1].reach.includes(order.status);
              return (
                <Fragment key={step.label}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${done ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'}`}>
                    {done ? <Check size={15} /> : <span className="text-xs font-medium">{i + 1}</span>}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 transition-colors ${lineActive ? 'bg-green-400' : 'bg-slate-200'}`} />
                  )}
                </Fragment>
              );
            })}
          </div>
          <div className="flex justify-between mt-2.5">
            {STEPS.map((step) => (
              <span key={step.label} className={`text-xs text-center flex-1 leading-tight ${step.reach.includes(order.status) ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                {step.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status changer (admin only): only the moves the server allows next */}
      {!isCustomer && (
        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-3">Update Status</h2>
          {order.allowed_next?.length ? (
            <>
              <p className="text-sm text-slate-500 mb-3">Move this order to:</p>
              <div className="flex flex-wrap gap-2">
                {order.allowed_next.map((s) => (
                  <button
                    key={s}
                    disabled={updatingStatus}
                    onClick={() => handleStatusChange(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors disabled:opacity-50 ${
                      s === 'cancelled'
                        ? 'bg-white border-rose-200 text-rose-600 hover:bg-rose-50'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {s === 'cancelled' ? 'Cancel order' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
              {order.payment_method === 'stripe' && order.status === 'pending' && (
                <p className="text-xs text-slate-400 mt-3">Card orders move to paid automatically once Stripe confirms the payment.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">
              This order is {order.status} and can no longer change.
              {order.status === 'delivered' && ' Problems after delivery are handled as returns.'}
            </p>
          )}
        </div>
      )}

      {/* Customer cancel, until the store starts preparing the order */}
      {isCustomer && order.can_cancel && (
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900">Changed your mind?</h2>
            <p className="text-sm text-slate-500">
              You can cancel until we start preparing your order
              {refundOnCancel(order) ? '; the payment is refunded to your card.' : '.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCustomerCancel}
            disabled={updatingStatus}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            {updatingStatus ? 'Cancelling…' : 'Cancel order'}
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Customer info */}
        {!isCustomer && (
          <div className="card">
            <h2 className="font-semibold text-slate-900 mb-3">Customer</h2>
            <p className="font-medium text-slate-900">{order.customer_name}</p>
            <p className="text-sm text-slate-500">{order.customer_email}</p>
          </div>
        )}

        {/* Shipping address */}
        {addr && (
          <div className="card">
            <h2 className="font-semibold text-slate-900 mb-3">
              Shipping Address
            </h2>
            <p className="text-sm text-slate-700">{addr.name}</p>
            <p className="text-sm text-slate-700">{addr.line1}</p>
            {addr.line2 && (
              <p className="text-sm text-slate-700">{addr.line2}</p>
            )}
            <p className="text-sm text-slate-700">
              {addr.city}, {addr.state} {addr.zip}
            </p>
            <p className="text-sm text-slate-700">{addr.country}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Items</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {order.items?.map((item) => (
            <div key={item.id} className="flex items-center gap-4 px-6 py-4">
              <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden shrink-0">
                {item.product_image ? (
                  <img
                    src={item.product_image}
                    alt={item.product_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package size={20} className="m-auto text-slate-400 mt-3" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-slate-900">{item.product_name}</p>
                {(item.variant_label || item.sku) && (
                  <p className="text-sm text-slate-600">
                    {item.variant_label}
                    {item.variant_label && item.sku && " · "}
                    {item.sku && <span className="font-mono text-xs text-slate-500">SKU {item.sku}</span>}
                  </p>
                )}
                <p className="text-sm text-slate-500">
                  Qty: {item.quantity} × $
                  {Number.parseFloat(item.unit_price).toFixed(2)}
                </p>
              </div>
              <p className="font-semibold text-slate-900">
                ${Number.parseFloat(item.total).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-slate-200 px-6 py-4 space-y-2">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Subtotal</span>
            <span>${Number.parseFloat(order.subtotal).toFixed(2)}</span>
          </div>
          {Number.parseFloat(order.discount) > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-${Number.parseFloat(order.discount).toFixed(2)}</span>
            </div>
          )}
          {Number.parseFloat(order.tax) > 0 && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>Tax</span>
              <span>${Number.parseFloat(order.tax).toFixed(2)}</span>
            </div>
          )}
          {Number.parseFloat(order.shipping) > 0 && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>Shipping</span>
              <span>${Number.parseFloat(order.shipping).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-slate-900 text-base border-t border-slate-100 pt-2">
            <span>Total</span>
            <span>${Number.parseFloat(order.total).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-slate-600 pt-1">
            <span>Payment</span>
            <span className="flex items-center gap-2">
              {order.payment_method === 'stripe' ? 'Card (Stripe)' : 'Cash on Delivery'}
              <span className={`badge ${paymentBadge[order.payment_status ?? 'unpaid'] ?? 'bg-slate-100 text-slate-700'}`}>
                {paymentLabel(order.payment_status)}
              </span>
            </span>
          </div>
          {Number.parseFloat(order.refunded_amount ?? '0') > 0 && (
            <div className="flex justify-between text-sm text-slate-600">
              <span>Refunded</span>
              <span>-${Number.parseFloat(order.refunded_amount ?? '0').toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tracking info */}
      {hasTracking && order.status !== 'cancelled' && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Truck size={18} className="text-purple-500" />
            <h2 className="font-semibold text-slate-900">Shipment Tracking</h2>
          </div>
          {order.carrier && (
            <p className="text-sm text-slate-700"><span className="font-medium">Carrier:</span> {order.carrier}</p>
          )}
          {order.tracking_number && (
            <p className="text-sm text-slate-700 mt-1 font-mono">
              <span className="font-sans font-medium">Tracking #:</span> {order.tracking_number}
            </p>
          )}
          {order.tracking_number && (
            <a
              href={getTrackingUrl(order.carrier ?? '', order.tracking_number)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 btn-primary text-sm"
            >
              Track Package <ExternalLink size={14} />
            </a>
          )}
        </div>
      )}

      {order.notes && (
        <div className="card">
          <h2 className="font-semibold text-slate-900 mb-2">Notes</h2>
          <p className="text-sm text-slate-600">{order.notes}</p>
        </div>
      )}

      {/* Shipment modal */}
      {showShipModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Truck size={20} className="text-purple-500" />
              <h2 className="text-lg font-semibold text-slate-900">Ship Order</h2>
            </div>
            <form onSubmit={handleShipSubmit} className="space-y-4">
              <div>
                <label htmlFor="ship-carrier" className="block text-sm font-medium text-slate-700 mb-1">
                  Parcel Service / Carrier
                </label>
                <input
                  id="ship-carrier"
                  type="text"
                  className="input"
                  placeholder="e.g. UPS, FedEx, USPS, DHL"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="ship-tracking" className="block text-sm font-medium text-slate-700 mb-1">
                  Tracking Number *
                </label>
                <input
                  id="ship-tracking"
                  type="text"
                  className="input"
                  placeholder="Enter tracking number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-slate-400">The customer is notified with the carrier and tracking number.</p>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="btn-primary" disabled={updatingStatus}>
                  {updatingStatus ? 'Saving...' : 'Confirm Shipment'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowShipModal(false)} disabled={updatingStatus}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return & Refund (customer only, delivered orders; before that they cancel) */}
      {isCustomer && order.status === 'delivered' && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <RotateCcw size={18} className="text-slate-500" />
            <h2 className="font-semibold text-slate-900">Return & Refund</h2>
          </div>
          {renderReturnBody(order)}
        </div>
      )}
    </div>
  );

  function renderReturnBody(order: Order) {
    if (returnRequest) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Status:</span>
            <span className={`badge ${returnStatusColors[returnRequest.status] ?? 'bg-slate-100 text-slate-800'}`}>
              {returnRequest.status}
            </span>
          </div>
          <p className="text-sm text-slate-600">
            <span className="font-medium">Reason:</span> {returnRequest.reason}
          </p>
          {returnRequest.refund_amount && (
            <p className="text-sm text-green-700 font-medium">
              Refund amount: ${Number.parseFloat(returnRequest.refund_amount).toFixed(2)}
            </p>
          )}
          {returnRequest.admin_notes && (
            <p className="text-sm text-slate-500">
              <span className="font-medium">Store note:</span> {returnRequest.admin_notes}
            </p>
          )}
        </div>
      );
    }

    const daysSince = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 86400000);
    const daysLeft = returnWindowDays - daysSince;
    if (daysSince > returnWindowDays) {
      return (
        <p className="text-sm text-red-600">
          The return window for this order has expired. Returns must be requested within {returnWindowDays} days of the order date.
        </p>
      );
    }

    const remaining = `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining to request a return.`;
    if (!showReturnForm) {
      return (
        <div>
          <p className="text-sm text-slate-500 mb-3">{remaining}</p>
          <button onClick={() => setShowReturnForm(true)} className="btn-secondary flex items-center gap-2">
            <RotateCcw size={15} /> Request Return
          </button>
        </div>
      );
    }

    return (
      <form onSubmit={handleReturnSubmit} className="space-y-3">
        <p className="text-xs text-slate-400">{remaining}</p>
        <div>
          <label htmlFor="return-reason" className="block text-sm font-medium text-slate-700 mb-1">Reason for return</label>
          <textarea
            id="return-reason"
            className="input resize-none h-24"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="Please describe the reason for your return..."
            required
          />
        </div>
        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={submittingReturn}>
            {submittingReturn ? 'Submitting...' : 'Submit Request'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowReturnForm(false)}>
            Cancel
          </button>
        </div>
      </form>
    );
  }
}
