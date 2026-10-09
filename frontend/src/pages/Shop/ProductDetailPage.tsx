import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import { ShoppingCart, Package, ArrowLeft, Minus, Plus, Truck, RotateCcw, Shield } from 'lucide-react';
import api from '../../api';
import { addItem } from '../../store/slices/cartSlice';
import {
  Variant, applyDiscount, formatPrice, effectivePriceRange, sellableStock, variantBasePrice, variantLabel,
} from '../../utils/pricing';
import VariantPicker, { Selection, findVariant, initialSelection } from '../../components/Shop/VariantPicker';

const trustBadges = [
  { icon: Truck, label: 'Free shipping', sub: 'On orders over $50' },
  { icon: RotateCcw, label: '30-day returns', sub: 'Hassle-free returns' },
  { icon: Shield, label: 'Secure payment', sub: 'Encrypted checkout' },
];

export default function ProductDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selection, setSelection] = useState<Selection>({});

  useEffect(() => {
    api.get(`/products/${slug}`).then((res) => {
      setProduct(res.data.product);
      setSelection(initialSelection(res.data.product.variants ?? []));
      setQuantity(1);
    }).catch(() => {
      toast.error('Product not found');
      navigate('/');
    }).finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!product) return null;

  const options = product.options ?? [];
  const variants: Variant[] = product.variants ?? [];
  const hasOptions = options.length > 0;
  // The variant being bought: the chosen combination, or the only one.
  const variant = hasOptions ? findVariant(variants, options, selection) : variants[0] ?? null;
  const missing = options.filter((o: { name: string }) => !selection[o.name]).map((o: { name: string }) => o.name);
  const label = variant ? variantLabel(options, variant.options) : null;

  // Stock minus other carts' active holds, for the chosen variant.
  let sellable = 0;
  if (variant) sellable = variant.available_stock ?? variant.stock;
  else if (!hasOptions) sellable = sellableStock(product);

  const images = product.images ?? [];
  const primaryImage = images.find((i: any) => i.is_primary) ?? images[0];
  const displayImage = images[selectedImage] ?? primaryImage;
  const basePrice = variant ? variantBasePrice(product, variant) : Number.parseFloat(product.price);
  const effectivePrice = applyDiscount(product, basePrice);
  const hasDiscount = effectivePrice < basePrice;
  const savings = (basePrice - effectivePrice) * quantity;
  const range = effectivePriceRange(product);
  // Until a full combination is chosen, show the range rather than one price.
  const showRange = hasOptions && !variant && range.min !== range.max;

  const choose = (next: Selection) => {
    setSelection(next);
    setQuantity(1);
  };

  const handleAddToCart = () => {
    if (hasOptions && !variant) return;
    dispatch(addItem({
      product_id: product.id,
      variant_id: variant?.id ?? null,
      variant_label: label,
      sku: variant?.sku ?? null,
      slug: product.slug,
      name: product.name,
      price: basePrice,
      effective_price: effectivePrice,
      image: primaryImage?.url,
      quantity,
      stock: sellable,
    }));
    toast.success('Added to cart!');
  };

  const stockStatus = () => {
    if (hasOptions && !variant) {
      const text = missing.length ? `Choose ${missing.join(' and ').toLowerCase()}` : 'This combination is not available';
      return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500"><span className="w-2 h-2 rounded-full bg-slate-300" />{text}</span>;
    }
    if (sellable === 0) return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600"><span className="w-2 h-2 rounded-full bg-rose-500" />Out of Stock</span>;
    if (sellable <= 5) return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600"><span className="w-2 h-2 rounded-full bg-amber-500" />Only {sellable} left</span>;
    return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500" />In Stock</span>;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary-600 transition-colors mb-6 group"
      >
        <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
        Back
      </button>

      <div className="grid md:grid-cols-2 gap-10">
        {/* Images */}
        <div className="space-y-3">
          <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
            {displayImage ? (
              <img src={displayImage.url} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package size={64} className="text-slate-200" />
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {images.map((img: any, i: number) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(i)}
                  className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                    selectedImage === i
                      ? 'border-primary-500 shadow-sm'
                      : 'border-slate-200 hover:border-primary-300'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          <div>
            {product.category_name && (
              <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">
                {product.category_name}{product.subcategory_name ? ` › ${product.subcategory_name}` : ''}
              </p>
            )}
            <h1 className="text-3xl font-bold text-slate-900 leading-tight">{product.name}</h1>
          </div>

          {/* Price */}
          <div className="py-4 border-y border-slate-100">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold text-slate-900">
                {showRange ? `${formatPrice(range.min)} – ${formatPrice(range.max)}` : `$${effectivePrice.toFixed(2)}`}
              </span>
              {hasDiscount && !showRange && (
                <>
                  <span className="text-xl text-slate-400 line-through font-medium">
                    ${basePrice.toFixed(2)}
                  </span>
                  <span className="bg-rose-100 text-rose-600 text-sm font-bold px-2.5 py-0.5 rounded-lg">
                    {product.discount_percent}% OFF
                  </span>
                </>
              )}
            </div>
            {hasDiscount && !showRange && quantity > 0 && (
              <p className="text-sm text-emerald-600 font-semibold mt-2">
                You save ${savings.toFixed(2)} on this order
              </p>
            )}
          </div>

          {hasOptions && (
            <VariantPicker options={options} variants={variants} selection={selection} onChange={choose} />
          )}

          {/* Stock */}
          <div>{stockStatus()}</div>

          {/* Quantity + CTA */}
          {sellable > 0 && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">Quantity</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-all"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-10 text-center font-bold text-lg">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(sellable, quantity + 1))}
                    className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 transition-all"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <button
                onClick={handleAddToCart}
                className="btn-primary w-full flex items-center justify-center gap-2.5 py-3.5 text-base"
              >
                <ShoppingCart size={18} />
                Add to Cart
              </button>
            </div>
          )}

          {/* Trust badges */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            {trustBadges.map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex flex-col items-center text-center p-3 bg-slate-50 rounded-xl">
                <Icon size={18} className="text-primary-500 mb-1.5" />
                <p className="text-xs font-semibold text-slate-700">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">{sub}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          {product.description && (
            <div className="border-t border-slate-100 pt-5">
              <h2 className="font-semibold text-slate-900 mb-2">Description</h2>
              <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{product.description}</p>
            </div>
          )}

          {(variant?.sku ?? product.sku) && (
            <p className="text-xs text-slate-400">SKU: {variant?.sku ?? product.sku}</p>
          )}
        </div>
      </div>
    </div>
  );
}
