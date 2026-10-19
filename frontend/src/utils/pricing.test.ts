import { describe, expect, it } from 'vitest';
import { applyDiscount, effectivePriceRange, hasActiveDiscount, type Product } from './pricing';
import { findVariant, initialSelection } from './variantSelection';
import { isStale, regenerate } from '../components/Admin/variantDrafts';

const product = (extra: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Mug',
  slug: 'mug',
  price: '100',
  compare_at_price: null,
  stock: 5,
  primary_image: null,
  discount_active: true,
  discount_percent: '20',
  discount_start: null,
  discount_end: null,
  category_name: null,
  ...extra,
});

describe('discounts', () => {
  it('applies a running discount', () => {
    expect(hasActiveDiscount(product())).toBe(true);
    expect(applyDiscount(product(), 50)).toBe(40);
  });

  it('ignores discounts that ended, have not started, or are off', () => {
    expect(hasActiveDiscount(product({ discount_end: '2000-01-01T00:00:00Z' }))).toBe(false);
    expect(hasActiveDiscount(product({ discount_start: '2999-01-01T00:00:00Z' }))).toBe(false);
    expect(hasActiveDiscount(product({ discount_active: false }))).toBe(false);
  });

  it('discounts the whole variant price range', () => {
    expect(effectivePriceRange(product({ price_min: 10, price_max: 50 }))).toEqual({ min: 8, max: 40 });
  });
});

describe('variants', () => {
  const variant = (id: string, options: Record<string, string>, stock: number) => ({
    id, sku: null, options, price: null, stock, is_active: true,
  });
  const options = [{ name: 'Size', values: ['S', 'M'] }];
  const variants = [variant('s', { Size: 'S' }, 0), variant('m', { Size: 'M' }, 3)];

  it('opens on the first variant in stock and finds full selections', () => {
    expect(initialSelection(variants)).toEqual({ Size: 'M' });
    expect(findVariant(variants, options, { Size: 'S' })?.id).toBe('s');
    expect(findVariant(variants, options, {})).toBeNull();
  });

  it('regenerates rows from options, keeping existing combinations', () => {
    const drafts = [{ name: 'Size', valuesText: 'S, M, M' }];
    const kept = { id: 'x', options: { Size: 'S' }, sku: 'KEEP', price: '', stock: '4', is_active: true };
    const rows = regenerate('Mug', drafts, [kept]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(kept);
    expect(rows[1].sku).toBe('MUG-M');
    expect(isStale([{ name: 'Size', valuesText: 'M' }], kept)).toBe(true);
  });
});
