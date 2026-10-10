import { useEffect, useState } from 'react';
import { formatDate } from '../../../utils/dates';
import toast from 'react-hot-toast';
import { RotateCcw } from 'lucide-react';
import api, { errorMessage } from '../../../api';
import ListContent from '../../../components/Admin/ListContent';

const statusColors: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-primary-100 text-primary-800',
  rejected: 'bg-red-100 text-red-800',
  refunded: 'bg-green-100 text-green-800',
};

// Decisions allowed from each return status (mirrors the server's rules).
const DECISIONS: Record<string, { value: string; label: string }[]> = {
  requested: [
    { value: 'approved', label: 'Approve' },
    { value: 'rejected', label: 'Reject' },
    { value: 'refunded', label: 'Approve & Issue Refund' },
  ],
  approved: [{ value: 'refunded', label: 'Issue Refund' }],
};

// What can still be refunded on the return's order.
const refundableLeft = (ret: any) =>
  Math.max(0, Number.parseFloat(ret.order_total ?? '0') - Number.parseFloat(ret.order_refunded_amount ?? '0'));

export default function ReturnsList() {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [selectedReturn, setSelectedReturn] = useState<any>(null);
  const [processForm, setProcessForm] = useState({ status: 'approved', refund_amount: '', admin_notes: '', restock: true });
  const [processing, setProcessing] = useState(false);

  const fetchReturns = async (s = status) => {
    setLoading(true);
    try {
      const res = await api.get('/returns', { params: { status: s || undefined, limit: 30 } });
      setReturns(res.data.returns);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReturns(); }, []);

  const openProcess = (ret: any) => {
    setSelectedReturn(ret);
    setProcessForm({
      status: DECISIONS[ret.status][0].value,
      // An amount set when approving is reused; otherwise what's left to refund.
      refund_amount: ret.refund_amount ?? refundableLeft(ret).toFixed(2),
      admin_notes: ret.admin_notes ?? '',
      restock: true,
    });
  };

  const handleProcess = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const { refund_amount, restock, ...rest } = processForm;
      const res = await api.put(`/returns/${selectedReturn.id}`, {
        ...rest,
        // Optional when approving (saved for the refund later); required to refund.
        ...(rest.status !== 'rejected' && refund_amount !== '' ? { refund_amount: Number(refund_amount) } : {}),
        ...(rest.status === 'refunded' ? { restock } : {}),
      });
      setReturns((prev) => prev.map((r) => r.id === selectedReturn.id ? { ...r, ...res.data.return } : r));
      toast.success('Return processed');
      setSelectedReturn(null);
    } catch (err: any) {
      toast.error(errorMessage(err, 'Processing failed'));
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Returns & Refunds</h1>
          <p className="text-slate-500 text-sm mt-0.5">{returns.length} returns</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['', 'requested', 'approved', 'rejected', 'refunded'].map((s) => (
          <button
            key={s || 'all'}
            onClick={() => { setStatus(s); fetchReturns(s); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              status === s ? 'bg-primary-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <ListContent loading={loading} isEmpty={returns.length === 0} emptyIcon={RotateCcw} emptyText="No returns found">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Return ID</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500 hidden md:table-cell">Customer</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Reason</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500 hidden sm:table-cell">Date</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Status</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returns.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    #{r.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <p className="font-medium text-slate-900">{r.customer_name}</p>
                    <p className="text-xs text-slate-400">{r.customer_email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-slate-700 max-w-[200px] truncate">{r.reason}</p>
                    {r.refund_amount && (
                      <p className="text-xs text-green-600 font-medium">
                        {r.status === 'refunded' ? 'Refunded' : 'Refund'}: ${Number.parseFloat(r.refund_amount).toFixed(2)}
                        {r.status === 'refunded' && (
                          <span className="text-slate-400 font-normal"> · {r.restocked ? 'restocked' : 'not restocked'}</span>
                        )}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500 hidden sm:table-cell">
                    {formatDate(r.created_at)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`badge ${statusColors[r.status] ?? 'bg-slate-100 text-slate-800'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {DECISIONS[r.status] && (
                      <button onClick={() => openProcess(r)} className="text-primary-600 hover:underline text-sm font-medium">
                        {r.status === 'approved' ? 'Refund' : 'Process'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ListContent>
      </div>

      {/* Process modal */}
      {selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close dialog" className="absolute inset-0 bg-black/50 cursor-default" onClick={() => setSelectedReturn(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Process Return</h2>
            <p className="text-sm text-slate-500 mb-5">Return #{selectedReturn.id.slice(0, 8).toUpperCase()}</p>
            <form onSubmit={handleProcess} className="space-y-4">
              <div>
                <label htmlFor="r_status" className="block text-sm font-medium text-slate-700 mb-1">Decision</label>
                <select id="r_status" className="input" value={processForm.status} onChange={(e) => setProcessForm({ ...processForm, status: e.target.value })}>
                  {DECISIONS[selectedReturn.status].map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              {processForm.status !== 'rejected' && (
                <div>
                  <label htmlFor="r_refund" className="block text-sm font-medium text-slate-700 mb-1">
                    Refund Amount ($){processForm.status === 'approved' && ' — optional, used when refunding'}
                  </label>
                  <input
                    id="r_refund"
                    type="number"
                    min="0.01"
                    max={refundableLeft(selectedReturn).toFixed(2)}
                    step="0.01"
                    className="input"
                    value={processForm.refund_amount}
                    onChange={(e) => setProcessForm({ ...processForm, refund_amount: e.target.value })}
                    required={processForm.status === 'refunded'}
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Up to ${refundableLeft(selectedReturn).toFixed(2)}
                    {selectedReturn.order_payment_method === 'stripe'
                      ? ' · refunded to the customer’s card through Stripe'
                      : ' · cash on delivery: give the money back yourself; this records it'}
                  </p>
                </div>
              )}
              {processForm.status === 'refunded' && (
                <label className="flex items-start gap-2.5 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="w-4 h-4 mt-0.5 rounded text-primary-600"
                    checked={processForm.restock}
                    onChange={(e) => setProcessForm({ ...processForm, restock: e.target.checked })}
                  />
                  <span>
                    Return items to stock
                    <span className="block text-xs text-slate-400">Untick if the items are damaged and can’t be sold again.</span>
                  </span>
                </label>
              )}
              <div>
                <label htmlFor="r_notes" className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
                <textarea id="r_notes" className="input resize-none h-20" value={processForm.admin_notes} onChange={(e) => setProcessForm({ ...processForm, admin_notes: e.target.value })} />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="btn-primary flex-1" disabled={processing}>
                  {processing ? 'Processing...' : 'Confirm'}
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setSelectedReturn(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
