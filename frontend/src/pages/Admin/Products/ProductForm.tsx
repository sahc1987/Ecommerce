import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ArrowLeft, Upload, Star, Trash2 } from "lucide-react";
import ProductImage from "../../../components/Shop/ProductImage";
import api, { errorMessage } from "../../../api";
import VariantEditor from "../../../components/Admin/VariantEditor";
import { type OptionDraft, type VariantDraft, cleanOptions, isStale } from "../../../components/Admin/variantDrafts";
import { type Product, type Variant, currencySymbol } from "../../../utils/pricing";

// Left padding that clears the currency prefix ("$", "R$", "CA$").
const PREFIX_PAD = ["pl-7", "pl-7", "pl-9", "pl-11"];

interface Category {
  id: number;
  name: string;
}

interface Subcategory {
  id: number;
  name: string;
}

interface ProductPhoto {
  id: string;
  url: string;
  is_primary: boolean;
}

// GET /products/admin/:id: every variant (inactive too) plus the edit fields.
type AdminProductDetail = Product & {
  description: string | null;
  sku: string | null;
  subcategory_id: number | null;
  is_active: boolean;
  images: ProductPhoto[] | null;
  variants: Variant[];
};

const toDraft = (v: Variant): VariantDraft => ({
  id: v.id,
  options: v.options,
  sku: v.sku ?? "",
  price: v.price === null ? "" : String(v.price),
  stock: String(v.stock),
  is_active: v.is_active,
});

export default function ProductForm() {
  const currency = currencySymbol();
  const currencyPad = PREFIX_PAD[Math.min(currency.length, 3)];
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const idleSubmitLabel = isEdit ? "Save Changes" : "Create Product";
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [images, setImages] = useState<ProductPhoto[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  // With no options the product has one default variant, edited through the
  // plain SKU/Stock fields; defaultVariantId keeps its holds and order links.
  const [options, setOptions] = useState<OptionDraft[]>([]);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [defaultVariantId, setDefaultVariantId] = useState<string | undefined>();
  const hasOptions = options.length > 0;

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    compare_at_price: "",
    stock: "0",
    sku: "",
    category_id: "",
    subcategory_id: "",
    is_active: true,
    discount_active: false,
    discount_percent: "0",
    discount_start: "",
    discount_end: "",
  });

  useEffect(() => {
    // Ignore responses for a product we've navigated away from.
    let ignore = false;
    api.get<{ categories: Category[] }>("/categories").then((res) => {
      if (!ignore) setCategories(res.data.categories);
    });
    if (isEdit) {
      // The admin view includes inactive variants: saving replaces the whole
      // list, so the form must start from all of them.
      api
        .get<{ product: AdminProductDetail }>(`/products/admin/${id}`)
        .then(async (res) => {
          if (ignore) return;
          const p = res.data.product;
          const loadedOptions: OptionDraft[] = (p.options ?? []).map(
            (o) => ({ name: o.name, valuesText: o.values.join(", ") }),
          );
          setOptions(loadedOptions);
          if (loadedOptions.length) {
            setVariants(p.variants.map(toDraft));
          } else {
            setDefaultVariantId(p.variants[0]?.id);
          }
          setForm({
            name: p.name,
            description: p.description ?? "",
            price: p.price,
            compare_at_price: p.compare_at_price ?? "",
            stock: String(p.stock),
            sku: p.sku ?? "",
            category_id: p.category_id ? String(p.category_id) : "",
            subcategory_id: p.subcategory_id ? String(p.subcategory_id) : "",
            is_active: p.is_active,
            discount_active: p.discount_active,
            discount_percent: String(p.discount_percent ?? "0"),
            discount_start: p.discount_start
              ? p.discount_start.slice(0, 16)
              : "",
            discount_end: p.discount_end ? p.discount_end.slice(0, 16) : "",
          });
          setImages(p.images ?? []);
          if (p.category_id) {
            const subs = await api.get<{ subcategories: Subcategory[] }>(`/categories/${p.category_id}/subcategories`);
            if (!ignore) setSubcategories(subs.data.subcategories);
          }
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }
    return () => {
      ignore = true;
    };
  }, [id, isEdit]);

  const loadSubcategories = async (categoryId: string) => {
    if (!categoryId) return setSubcategories([]);
    const res = await api.get<{ subcategories: Subcategory[] }>(`/categories/${categoryId}/subcategories`);
    setSubcategories(res.data.subcategories);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setForm({ ...form, category_id: val, subcategory_id: "" });
    loadSubcategories(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasOptions) {
      if (!cleanOptions(options).length || cleanOptions(options).length !== options.length) {
        toast.error("Give every option a name and at least one value");
        return;
      }
      if (!variants.length) {
        toast.error("Click “Generate variants” to create the combinations");
        return;
      }
      if (variants.some((v) => isStale(options, v))) {
        toast.error("Click “Update variants” so they match the options");
        return;
      }
    }
    setSaving(true);
    try {
      const { stock, sku, ...rest } = form;
      const variantPayload = hasOptions
        ? variants.map((v) => ({
            id: v.id,
            options: v.options,
            sku: v.sku.trim() || null,
            price: v.price === "" ? null : Number.parseFloat(v.price),
            stock: Number.parseInt(v.stock, 10) || 0,
            is_active: v.is_active,
          }))
        : [{ id: defaultVariantId, options: {}, sku: sku.trim() || null, price: null, stock: Number.parseInt(stock, 10) || 0, is_active: true }];
      const payload = {
        ...rest,
        options: cleanOptions(options),
        variants: variantPayload,
        price: Number.parseFloat(form.price),
        compare_at_price: form.compare_at_price
          ? Number.parseFloat(form.compare_at_price)
          : null,
        discount_percent: Number.parseFloat(form.discount_percent),
        category_id: form.category_id || null,
        subcategory_id: form.subcategory_id || null,
        discount_start: form.discount_start || null,
        discount_end: form.discount_end || null,
      };
      if (isEdit) {
        const res = await api.put<{ product: AdminProductDetail }>(`/products/${id}`, payload);
        // New variants now have ids; keep them so the next save updates in place.
        const saved = res.data.product;
        if (hasOptions) {
          setVariants(saved.variants.map(toDraft));
        } else {
          setDefaultVariantId(saved.variants[0]?.id);
        }
        toast.success("Product updated");
      } else {
        const res = await api.post<{ product: AdminProductDetail }>("/products", payload);
        toast.success("Product created");
        navigate(`/admin/products/${res.data.product.id}/edit`);
        return;
      }
    } catch (err) {
      toast.error(errorMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !isEdit) return;
    setUploadingImages(true);
    const formData = new FormData();
    Array.from(e.target.files).forEach((f) => formData.append("images", f));
    try {
      const res = await api.post<{ images: ProductPhoto[] }>(`/products/${id}/images`, formData);
      setImages((prev) => [...prev, ...res.data.images]);
      toast.success("Images uploaded");
    } catch (err) {
      toast.error(errorMessage(err, "Upload failed"));
    } finally {
      setUploadingImages(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    try {
      await api.delete(`/products/${id}/images/${imageId}`);
      setImages((prev) => prev.filter((i) => i.id !== imageId));
      toast.success("Image removed");
    } catch {
      toast.error("Delete failed");
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    try {
      await api.put(`/products/${id}/images/${imageId}/primary`);
      setImages((prev) =>
        prev.map((i) => ({ ...i, is_primary: i.id === imageId })),
      );
    } catch {
      toast.error("Failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/admin/products")}
          className="p-1.5 -ml-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
          aria-label="Back to products"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">
          {isEdit ? "Edit Product" : "New Product"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-900">Basic Information</h2>
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Product Name *
            </label>
            <input
              id="name"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              className="input resize-none h-32"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          {!hasOptions && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="sku"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                SKU
              </label>
              <input
                id="sku"
                className="input"
                placeholder="PROD-001"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
            </div>
            <div>
              <label
                htmlFor="stock"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Stock *
              </label>
              <input
                id="stock"
                type="number"
                min="0"
                className="input"
                value={form.stock}
                onChange={(e) => setForm({ ...form, stock: e.target.value })}
                required
              />
            </div>
          </div>
          )}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              checked={form.is_active}
              onChange={(e) =>
                setForm({ ...form, is_active: e.target.checked })
              }
              className="w-4 h-4 rounded-sm text-primary-600"
            />
            <label
              htmlFor="is_active"
              className="text-sm font-medium text-slate-700"
            >
              Active (visible to customers)
            </label>
          </div>
        </div>

        {/* Pricing */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-900">Pricing</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="price" className="block text-sm font-medium text-slate-700 mb-1">
                Price *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {currency}
                </span>
                <input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`input ${currencyPad}`}
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="compare_at_price" className="block text-sm font-medium text-slate-700 mb-1">
                Compare-at Price
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  {currency}
                </span>
                <input
                  id="compare_at_price"
                  type="number"
                  min="0"
                  step="0.01"
                  className={`input ${currencyPad}`}
                  value={form.compare_at_price}
                  onChange={(e) =>
                    setForm({ ...form, compare_at_price: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="discount_active"
                checked={form.discount_active}
                onChange={(e) =>
                  setForm({ ...form, discount_active: e.target.checked })
                }
                className="w-4 h-4 rounded-sm text-primary-600"
              />
              <label
                htmlFor="discount_active"
                className="text-sm font-medium text-slate-700"
              >
                Enable Discount
              </label>
            </div>
            {form.discount_active && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="discount_percent" className="block text-sm font-medium text-slate-700 mb-1">
                    Discount %
                  </label>
                  <div className="relative">
                    <input
                      id="discount_percent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      className="input pr-7"
                      value={form.discount_percent}
                      onChange={(e) =>
                        setForm({ ...form, discount_percent: e.target.value })
                      }
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
                      %
                    </span>
                  </div>
                </div>
                <div>
                  <label htmlFor="discount_start" className="block text-sm font-medium text-slate-700 mb-1">
                    Start (optional)
                  </label>
                  <input
                    id="discount_start"
                    type="datetime-local"
                    className="input text-sm"
                    value={form.discount_start}
                    onChange={(e) =>
                      setForm({ ...form, discount_start: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label htmlFor="discount_end" className="block text-sm font-medium text-slate-700 mb-1">
                    End (optional)
                  </label>
                  <input
                    id="discount_end"
                    type="datetime-local"
                    className="input text-sm"
                    value={form.discount_end}
                    onChange={(e) =>
                      setForm({ ...form, discount_end: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Options & variants */}
        <div className="card space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">Options &amp; Variants</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {hasOptions
                ? "Each combination is a variant with its own SKU, stock and (optional) price."
                : "Sold in sizes, colors or capacities? Add an option to sell each combination separately."}
            </p>
          </div>
          <VariantEditor
            productName={form.name}
            basePrice={form.price}
            options={options}
            variants={variants}
            onOptionsChange={(next) => {
              setOptions(next);
              if (!next.length) setVariants([]);
            }}
            onVariantsChange={setVariants}
          />
        </div>

        {/* Category */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-900">Organization</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="category_id" className="block text-sm font-medium text-slate-700 mb-1">
                Category
              </label>
              <select
                id="category_id"
                className="input"
                value={form.category_id}
                onChange={handleCategoryChange}
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="subcategory_id" className="block text-sm font-medium text-slate-700 mb-1">
                Subcategory
              </label>
              <select
                id="subcategory_id"
                className="input"
                value={form.subcategory_id}
                onChange={(e) =>
                  setForm({ ...form, subcategory_id: e.target.value })
                }
                disabled={!form.category_id}
              >
                <option value="">Select subcategory</option>
                {subcategories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Images */}
        <div className="card space-y-4">
          <h2 className="font-semibold text-slate-900">Images</h2>
          {!isEdit && (
            <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
              Save the product first, then you can add images.
            </p>
          )}
          {isEdit && (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {/* Same neutral, uncropped frame the shop uses, so this is what
                    customers see. Actions stay visible for keyboard and touch. */}
                {images.map((img, i) => (
                  <div key={img.id} className="flex flex-col gap-1.5">
                    <ProductImage
                      src={img.url}
                      alt={`${form.name || "Product"} photo ${i + 1}`}
                      className="aspect-square w-full"
                    />
                    <div className="flex items-center justify-between gap-1">
                      {img.is_primary ? (
                        <span className="badge bg-primary-50 text-primary-700 gap-1">
                          <Star size={11} fill="currentColor" aria-hidden="true" /> Primary
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSetPrimary(img.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-primary-700 px-1.5 py-1 rounded-md hover:bg-slate-100"
                          aria-label={`Set photo ${i + 1} as primary`}
                        >
                          <Star size={12} aria-hidden="true" /> Set primary
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(img.id)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                        aria-label={`Delete photo ${i + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingImages}
                  className="aspect-square border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-500 hover:border-primary-400 hover:text-primary-500 transition-colors"
                >
                  <Upload size={20} />
                  <span className="text-xs mt-1">
                    {uploadingImages ? "Uploading..." : "Add images"}
                  </span>
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
            </>
          )}
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : idleSubmitLabel}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate("/admin/products")}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
