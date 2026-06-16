import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { Upload, Store } from 'lucide-react';
import api from '../../../api';

export default function StoreSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [store, setStore] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', currency: 'USD', email: '', phone: '', address: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'BRL', 'MXN'];

  useEffect(() => {
    api.get('/setup/status').then((res) => {
      const s = res.data.store;
      if (s) {
        setStore(s);
        setForm({ name: s.name, description: s.description || '', currency: s.currency, email: s.email || '', phone: s.phone || '', address: s.address || '' });
        if (s.logo_url) setLogoPreview(s.logo_url);
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/setup/complete', form);
      toast.success('Store settings saved');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed');
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
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Store Settings</h1>

      {/* Logo */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-4">Store Logo</h2>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden flex items-center justify-center border border-gray-200">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <Store size={28} className="text-gray-400" />
            )}
          </div>
          <div>
            <button onClick={() => fileRef.current?.click()} className="btn-secondary flex items-center gap-2">
              <Upload size={15} /> Upload Logo
            </button>
            <p className="text-xs text-gray-400 mt-1.5">PNG, JPG up to 5MB</p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5">
        <h2 className="font-semibold text-gray-900">Store Information</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Store Name *</label>
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea className="input resize-none h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
          <select className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
            {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="tel" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <textarea className="input resize-none h-20" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
