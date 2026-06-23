import { Fragment, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Check, ExternalLink, Package, RotateCcw, Truck } from "lucide-react";
import api from "../../../api";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  processing: "bg-indigo-100 text-indigo-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

const returnStatusColors: Record<string, string> = {
  requested: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  refunded: "bg-green-100 text-green-800",
};

const STATUSES = [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
];

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

interface Props {
  isCustomer?: boolean;
}

export default function OrderDetail({ isCustomer }: Readonly<Props>) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [showShipModal, setShowShipModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrier, setCarrier] = useState('');
  const [returnRequest, setReturnRequest] = useState<any>(null);
  const [returnWindowDays, setReturnWindowDays] = useState(30);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  useEffect(() => {
    const loadOrder = api.get(`/orders/${id}`).then((res) => setOrder(res.data.order));
    if (isCustomer) {
      Promise.all([
        loadOrder,
        api.get('/setup/status').then((res) => setReturnWindowDays(res.data.store?.return_window_days ?? 30)),
        api.get('/returns', { params: { order_id: id, limit: 1 } }).then((res) => {
          if (res.data.returns.length > 0) setReturnRequest(res.data.returns[0]);
        }),
      ]).finally(() => setLoading(false));
    } else {
      loadOrder.finally(() => setLoading(false));
    }
  }, [id]);

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReturn(true);
    try {
      const res = await api.post('/returns', { order_id: id, reason: returnReason });
      setReturnRequest(res.data.return);
      setShowReturnForm(false);
      setReturnReason('');
      toast.success('Return request submitted');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit return request');
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleStatusChange = async (status: string) => {
    if (status === 'shipped') {
      setTrackingNumber(order.tracking_number || '');
      setCarrier(order.carrier || '');
      setShowShipModal(true);
      return;
    }
    if (status === 'cancelled' && !window.confirm('Cancel this order? This cannot be undone.')) return;
    setUpdatingStatus(true);
    try {
      await api.put(`/orders/${id}/status`, { status });
      setOrder((prev: any) => ({ ...prev, status }));
      toast.success("Status updated");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Update failed");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleShipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingStatus(true);
    try {
      const res = await api.put(`/orders/${id}/status`, { status: 'shipped', tracking_number: trackingNumber, carrier });
      setOrder(res.data.order);
      setShowShipModal(false);
      toast.success("Order marked as shipped");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Update failed");
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (!order)
    return <p className="text-center text-gray-500 py-16">Order not found</p>;

  const addr = order.shipping_address;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(isCustomer ? "/orders" : "/admin/orders")}
          className="text-gray-400 hover:text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Order #{order.id.substring(0, 8).toUpperCase()}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Placed {new Date(order.created_at).toLocaleString()}
          </p>
        </div>
        <span
          className={`badge ${statusColors[order.status] ?? "bg-gray-100 text-gray-800"} ml-auto text-sm px-3 py-1`}
        >
          {order.status}
        </span>
      </div>

      {/* Shipment progress (customer view, non-cancelled) */}
      {isCustomer && order.status !== 'cancelled' && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-5">Order Progress</h2>
          <div className="flex items-center">
            {STEPS.map((step, i) => {
              const done = step.reach.includes(order.status);
              const lineActive = i < STEPS.length - 1 && STEPS[i + 1].reach.includes(order.status);
              return (
                <Fragment key={step.label}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                    {done ? <Check size={15} /> : <span className="text-xs font-medium">{i + 1}</span>}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 transition-colors ${lineActive ? 'bg-green-400' : 'bg-gray-200'}`} />
                  )}
                </Fragment>
              );
            })}
          </div>
          <div className="flex justify-between mt-2.5">
            {STEPS.map((step) => (
              <span key={step.label} className={`text-xs text-center flex-1 leading-tight ${step.reach.includes(order.status) ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                {step.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status changer (admin only) */}
      {!isCustomer && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Update Status</h2>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                disabled={order.status === s || updatingStatus}
                onClick={() => handleStatusChange(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  order.status === s
                    ? `${statusColors[s]} border-transparent`
                    : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Customer info */}
        {!isCustomer && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3">Customer</h2>
            <p className="font-medium text-gray-900">{order.customer_name}</p>
            <p className="text-sm text-gray-500">{order.customer_email}</p>
          </div>
        )}

        {/* Shipping address */}
        {addr && (
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-3">
              Shipping Address
            </h2>
            <p className="text-sm text-gray-700">{addr.name}</p>
            <p className="text-sm text-gray-700">{addr.line1}</p>
            {addr.line2 && (
              <p className="text-sm text-gray-700">{addr.line2}</p>
            )}
            <p className="text-sm text-gray-700">
              {addr.city}, {addr.state} {addr.zip}
            </p>
            <p className="text-sm text-gray-700">{addr.country}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Items</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {order.items?.map((item: any) => (
            <div key={item.id} className="flex items-center gap-4 px-6 py-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                {item.product_image ? (
                  <img
                    src={item.product_image}
                    alt={item.product_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package size={20} className="m-auto text-gray-400 mt-3" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{item.product_name}</p>
                <p className="text-sm text-gray-500">
                  Qty: {item.quantity} × $
                  {Number.parseFloat(item.unit_price).toFixed(2)}
                </p>
              </div>
              <p className="font-semibold text-gray-900">
                ${Number.parseFloat(item.total).toFixed(2)}
              </p>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-gray-200 px-6 py-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>${parseFloat(order.subtotal).toFixed(2)}</span>
          </div>
          {parseFloat(order.discount) > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-${parseFloat(order.discount).toFixed(2)}</span>
            </div>
          )}
          {parseFloat(order.tax) > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tax</span>
              <span>${parseFloat(order.tax).toFixed(2)}</span>
            </div>
          )}
          {parseFloat(order.shipping) > 0 && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Shipping</span>
              <span>${parseFloat(order.shipping).toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-100 pt-2">
            <span>Total</span>
            <span>${parseFloat(order.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Tracking info */}
      {(order.tracking_number || order.carrier) && order.status !== 'cancelled' && (
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Truck size={18} className="text-purple-500" />
            <h2 className="font-semibold text-gray-900">Shipment Tracking</h2>
          </div>
          {order.carrier && (
            <p className="text-sm text-gray-700"><span className="font-medium">Carrier:</span> {order.carrier}</p>
          )}
          {order.tracking_number && (
            <p className="text-sm text-gray-700 mt-1 font-mono">
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
          <h2 className="font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-sm text-gray-600">{order.notes}</p>
        </div>
      )}

      {/* Shipment modal */}
      {showShipModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Truck size={20} className="text-purple-500" />
              <h2 className="text-lg font-semibold text-gray-900">Ship Order</h2>
            </div>
            <form onSubmit={handleShipSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parcel Service / Carrier
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. UPS, FedEx, USPS, DHL"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tracking Number
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter tracking number"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-400">Both fields are optional but recommended. The customer will be notified.</p>
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

      {/* Return & Refund (customer only, eligible orders) */}
      {isCustomer && ['delivered', 'paid'].includes(order.status) && (() => {
        const daysSince = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 86400000);
        const withinWindow = daysSince <= returnWindowDays;
        const daysLeft = returnWindowDays - daysSince;

        return (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <RotateCcw size={18} className="text-gray-500" />
              <h2 className="font-semibold text-gray-900">Return & Refund</h2>
            </div>

            {returnRequest ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className={`badge ${returnStatusColors[returnRequest.status] ?? 'bg-gray-100 text-gray-800'}`}>
                    {returnRequest.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Reason:</span> {returnRequest.reason}
                </p>
                {returnRequest.refund_amount && (
                  <p className="text-sm text-green-700 font-medium">
                    Refund amount: ${parseFloat(returnRequest.refund_amount).toFixed(2)}
                  </p>
                )}
                {returnRequest.admin_notes && (
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Store note:</span> {returnRequest.admin_notes}
                  </p>
                )}
              </div>
            ) : !withinWindow ? (
              <p className="text-sm text-red-600">
                The return window for this order has expired. Returns must be requested within {returnWindowDays} days of the order date.
              </p>
            ) : showReturnForm ? (
              <form onSubmit={handleReturnSubmit} className="space-y-3">
                <p className="text-xs text-gray-400">{daysLeft} day{daysLeft === 1 ? '' : 's'} remaining to request a return.</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for return</label>
                  <textarea
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
            ) : (
              <div>
                <p className="text-sm text-gray-500 mb-3">
                  {daysLeft} day{daysLeft === 1 ? '' : 's'} remaining to request a return.
                </p>
                <button onClick={() => setShowReturnForm(true)} className="btn-secondary flex items-center gap-2">
                  <RotateCcw size={15} /> Request Return
                </button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
