import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { addItem, lineKey } from '../store/slices/cartSlice';
import { Product, getEffectivePrice, needsOptions, singleVariant } from '../utils/pricing';

/**
 * Adds one unit of a product from a card or list, then calls `onAdded` with
 * the cart line's key (the shop opens the cart drawer on it). Products with
 * options (size, color…) need a choice first, so their page opens instead.
 */
export function useAddToCart(onAdded: (key: string) => void) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  return (p: Product) => {
    if (needsOptions(p)) {
      navigate(`/products/${p.slug}`);
      return;
    }
    const only = singleVariant(p);
    const line = {
      product_id: p.id,
      variant_id: only?.id ?? null,
      sku: only?.sku ?? null,
      slug: p.slug,
      name: p.name,
      price: Number.parseFloat(p.price),
      effective_price: getEffectivePrice(p),
      image: p.primary_image ?? undefined,
      quantity: 1,
      stock: p.available_stock ?? p.stock,
    };
    dispatch(addItem(line));
    onAdded(lineKey(line));
  };
}
