import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { Upload, Store } from 'lucide-react';
import api, { errorMessage } from '../../../api';
import TimeZoneSelect from '../../../components/TimeZoneSelect';
import { mediaUrl } from '../../../utils/media';
import { textOr } from '../../../utils/text';
import { browserTimeZone, setStoreTimeZone } from '../../../utils/dates';

export default function StoreSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', currency: 'USD', email: '', phone: '', address: '', tax_rate: '0', tax_enabled: false, return_window_days: '30', timezone: browserTimeZone() });
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'BRL', 'MXN'];

  useEffect(() => {
    api.get('/setup/status').then((res) => {
      const s = res.data.store;
      if (s) {
        setForm({ name: s.name, description: s.description ?? '', currency: s.currency, email: s.email ?? '', phone: s.phone ?? '', address: s.address ?? '', tax_rate: String(s.tax_rate ?? 0), tax_enabled: !!s.tax_enabled, return_window_days: String(s.return_window_days ?? 30), timezone: textOr(s.timezone, 'UTC') });
        if (s.logo_url) setLogoPreview(s.logo_url);
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/setup/complete', form);
      setStoreTimeZone(form.timezone);
      toast.success('Store settings saved');
    } catch (err: any) {
      toast.error(errorMessage(err, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setLogoPreview(preview);
    const fd = new FormData();
    fd.append('logo', file);
    try {
      const res = await api.post('/setup/logo', fd);
      toast.success('Logo updated');
      setLogoPreview(res.data.logo_url);
    } catch {
      toast.error('Upload failed');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Store Settings</h1>

      {/* Logo */}
      <div className="card">
        <h2 className="font-semibold text-slate-900 mb-4">Store Logo</h2>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200">
            {logoPreview ? (
              <img src={mediaUrl(logoPreview)} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Store size={28} className="text-slate-400" />
            )}
          </div>
          <div>
            <button onClick={() => fileRef.current?.click()} className="btn-secondary flex items-center gap-2">
              <Upload size={15} /> Upload Logo
            </button>
            <p className="text-xs text-slate-400 mt-1.5">PNG, JPG up to 5MB</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <h2 className="font-semibold text-slate-900">Store Information</h2>
        <div>
          <label htmlFor="store_name" className="block text-sm font-medium text-slate-700 mb-1">Store Name *</label>
          <input id="store_name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label htmlFor="store_description" className="block text-sm font-medium text-slate-700 mb-1">Description</label>
          <textarea id="store_description" className="input resize-none h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-slate-700 mb-1">Currency</label>
          <select id="currency" className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-slate-700 mb-1">Time Zone</label>
          <TimeZoneSelect value={form.timezone} onChange={(tz) => setForm({ ...form, timezone: tz })} />
          <p className="text-xs text-slate-400 mt-1">
            Order dates, notifications and daily sales reports are shown in this zone across the web store, admin panel and mobile app.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="store_email" className="block text-sm font-medium text-slate-700 mb-1">Contact Email</label>
            <input id="store_email" type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label htmlFor="store_phone" className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input id="store_phone" type="tel" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div>
          <label htmlFor="store_address" className="block text-sm font-medium text-slate-700 mb-1">Address</label>
          <textarea id="store_address" className="input resize-none h-20" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="border-t border-slate-100 pt-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Tax Configuration</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Enable Tax</p>
              <p className="text-xs text-slate-400 mt-0.5">Apply sales tax to all orders</p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, tax_enabled: !form.tax_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.tax_enabled ? 'bg-primary-600' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.tax_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {form.tax_enabled && (
            <div>
              <label htmlFor="tax_rate" className="block text-sm font-medium text-slate-700 mb-1">
                Tax Rate (%)
              </label>
              <div className="relative max-w-xs">
                <input
                  id="tax_rate"
                  type="number"
                  className="input pr-8"
                  value={form.tax_rate}
                  min="0"
                  max="100"
                  step="0.01"
                  onChange={(e) => setForm({ ...form, tax_rate: e.target.value })}
                  placeholder="e.g. 8.5"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Tax is applied on the order subtotal after discounts.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Return Policy</h2>
          <div>
            <label htmlFor="return_window_days" className="block text-sm font-medium text-slate-700 mb-1">
              Return Window (days)
            </label>
            <div className="relative max-w-xs">
              <input
                id="return_window_days"
                type="number"
                className="input pr-14"
                value={form.return_window_days}
                min="1"
                max="365"
                step="1"
                onChange={(e) => setForm({ ...form, return_window_days: e.target.value })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">days</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Customers can request a return within this many days of placing the order.
            </p>
          </div>
        </div>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
