import type { ProductOption, Variant } from './pricing';

// Which value the shopper picked for each option, e.g. { Color: 'Rojo' }.
export type Selection = Record<string, string>;

export const unitsLeft = (v: Variant) => v.available_stock ?? v.stock;

// The variant matching every option in `selection`, if all are chosen.
export function findVariant(variants: Variant[], options: ProductOption[], selection: Selection): Variant | null {
  if (options.some((o) => !selection[o.name])) return null;
  return variants.find((v) => options.every((o) => v.options[o.name] === selection[o.name])) ?? null;
}

// Start on the first variant that can be bought, so the page opens on a real
// price and stock instead of an empty selection.
export function initialSelection(variants: Variant[]): Selection {
  const first = variants.find((v) => unitsLeft(v) > 0) ?? variants[0];
  return first ? { ...first.options } : {};
}
