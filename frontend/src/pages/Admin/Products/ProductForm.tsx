import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Upload, X, Star } from 'lucide-react';
import api from '../../../api';

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    compare_at_price: '',
    stock: '0',
    sku: '',
    category_id: '',
    subcategory_id: '',
    is_active: true,
    discount_active: false,
    discount_percent: '0',
    discount_start: '',
    discount_end: '',
  });

  useEffect(() => {
    api.get('/categories').then((res) => setCategories(res.data.categories));
    if (isEdit) {
      setLoading(true);
      api.get(`/products/${id}`).then((res) => {
        const p = res.data.product;
        setForm({
          name: p.name,
          description: p.description || '',
          price: p.price,
          compare_at_price: p.compare_at_price || '',
          stock: String(p.stock),
          sku: p.sku || '',
          category_id: p.category_id ? String(p.category_id) : '',
          subcategory_id: p.subcategory_id ? String(p.subcategory_id) : '',
          is_active: p.is_active,
          discount_active: p.discount_active,
          discount_percent: String(p.discount_percent || '0'),
          discount_start: p.discount_start ? p.discount_start.substring(0, 16) : '',
          discount_end: p.discount_end ? p.discount_end.substring(0, 16) : '',
        });
        setImages(p.images || []);
        if (p.category_id) loadSubcategories(p.category_id);
      }).finally(() => setLoading(false));
    }
  }, [id]);

  const loadSubcategories = async (categoryId: string) => {
    if (!categoryId) return setSubcategories([]);
    const res = await api.get(`/categories/${categoryId}/subcategories`);
    setSubcategories(res.data.subcategories);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setForm({ ...form, category_id: val, subcategory_id: '' });
    loadSubcategories(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        compare_at_price: form.compare_at_price ? parseFloat(form.compare_at_price) : null,
        stock: parseInt(form.stock),
        discount_percent: parseFloat(form.discount_percent),
        category_id: form.category_id || null,
        subcategory_id: form.subcategory_id || null,
        discount_start: form.discount_start || null,
        discount_end: form.discount_end || null,
      };
      if (isEdit) {
        await api.put(`/products/${id}`, payload);
        toast.success('Product updated');
      } else {
        const res = await api.post('/products', payload);
        toast.success('Product created');
        navigate(`/admin/products/${res.data.product.id}/edit`);
        return;
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !isEdit) return;
    setUploadingImages(true);
    const formData = new FormData();
    Array.from(e.target.files).forEach((f) => formData.append('images', f));
    try {
      const res = await api.post(`/products/${id}/images`, formData);
      setImages((prev) => [...prev, ...res.data.images]);
      toast.success('Images uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploadingImages(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      await api.delete(`/products/${id}/images/${imageId}`);
      setImages((prev) => prev.filter((i) => i.id !== imageId));
      toast.success('Image removed');
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    try {
      await api.put(`/products/${id}/images/${imageId}/primary`);
      setImages((prev) => prev.map((i) => ({ ...i, is_primary: i.id === imageId })));
    } catch {
      toast.error('Failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/products')} className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Product' : 'New Product'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Basic Information</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="input resize-none h-32" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input className="input" placeholder="PROD-001" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stock *</label>
              <input type="number" min="0" className="input" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} required />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 rounded text-blue-600" />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">Active (visible to customers)</label>
          </div>
        </div>

        {/* Pricing */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Pricing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input type="number" min="0" step="0.01" className="input pl-7" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Compare-at Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input type="number" min="0" step="0.01" className="input pl-7" value={form.compare_at_price} onChange={(e) => setForm({ ...form, compare_at_price: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-4">
            <div className="flex items-center gap-3">
              <input type="checkbox" id="discount_active" checked={form.discount_active} onChange={(e) => setForm({ ...form, discount_active: e.target.checked })} className="w-4 h-4 rounded text-blue-600" />
              <label htmlFor="discount_active" className="text-sm font-medium text-gray-700">Enable Discount</label>
            </div>
            {form.discount_active && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                  <div className="relative">
                    <input type="number" min="0" max="100" step="0.1" className="input pr-7" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start (optional)</label>
                  <input type="datetime-local" className="input text-sm" value={form.discount_start} onChange={(e) => setForm({ ...form, discount_start: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End (optional)</label>
                  <input type="datetime-local" className="input text-sm" value={form.discount_end} onChange={(e) => setForm({ ...form, discount_end: e.target.value })} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Category */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Organization</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select className="input" value={form.category_id} onChange={handleCategoryChange}>
                <option value="">Select category</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
              <select className="input" value={form.subcategory_id} onChange={(e) => setForm({ ...form, subcategory_id: e.target.value })} disabled={!form.category_id}>
                <option value="">Select subcategory</option>
                {subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-900">Images</h2>
          {!isEdit && (
            <p className="text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              Save the product first, then you can add images.
            </p>
          )}
          {isEdit && (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {images.map((img) => (
                  <div key={img.id} className="relative group aspect-square">
                    <img src={img.url} alt="" className="w-full h-full object-cover rounded-lg border border-gray-200" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      <button type="button" onClick={() => handleSetPrimary(img.id)} className="bg-white/90 p-1.5 rounded-lg text-yellow-600 hover:bg-white" title="Set as primary">
                        <Star size={14} fill={img.is_primary ? 'currentColor' : 'none'} />
                      </button>
                      <button type="button" onClick={() => handleDeleteImage(img.id)} className="bg-white/90 p-1.5 rounded-lg text-red-600 hover:bg-white">
                        <X size={14} />
                      </button>
                    </div>
                    {img.is_primary && (
                      <span className="absolute top-1 left-1 bg-yellow-400 text-yellow-900 text-xs px-1.5 py-0.5 rounded font-medium">Primary</span>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingImages}
                  className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                >
                  <Upload size={20} />
                  <span className="text-xs mt-1">{uploadingImages ? 'Uploading...' : 'Add images'}</span>
                </button>
              </div>
              <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
            </>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate('/admin/products')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
