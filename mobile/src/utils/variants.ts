import type {Product, ProductOption, Variant} from '../types';

// Same rules as the web shop (frontend/src/utils/variantSelection.ts and
// frontend/src/components/Admin/variantDrafts.ts), so both clients behave alike.

export type Selection = Record<string, string>;

const unitsLeft = (v: Variant) => v.available_stock ?? v.stock;

/** The product's only variant when it has no options (null otherwise). */
export const singleVariant = (p: Product): Variant | null =>
  !p.options?.length && p.variants?.length === 1 ? p.variants[0] : null;

/** "Rojo / M" in option order; null for the default variant. */
export const variantLabel = (options: ProductOption[] | undefined, combo: Selection) => {
  const parts = (options ?? []).map(o => combo[o.name]).filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
};

/** The variant matching every option in `selection`, if all are chosen. */
export const findVariant = (variants: Variant[], options: ProductOption[], selection: Selection) => {
  if (options.some(o => !selection[o.name])) {
    return null;
  }
  return variants.find(v => options.every(o => v.options[o.name] === selection[o.name])) ?? null;
};

/** Start on the first variant that can be bought. */
export const initialSelection = (variants: Variant[]): Selection => {
  const first = variants.find(v => unitsLeft(v) > 0) ?? variants[0];
  return first ? {...first.options} : {};
};

/** Whether picking `value` (keeping the other choices) leads to a variant, and one with stock. */
export const valueState = (
  variants: Variant[],
  options: ProductOption[],
  selection: Selection,
  option: string,
  value: string,
) => {
  const wanted = {...selection, [option]: value};
  const matches = variants.filter(v =>
    options.every(o => !wanted[o.name] || v.options[o.name] === wanted[o.name]),
  );
  return {exists: matches.length > 0, inStock: matches.some(v => unitsLeft(v) > 0)};
};

// ---- Admin editing ---------------------------------------------------------

export interface OptionDraft {
  name: string;
  /** "Rojo, Azul" — comma separated */
  valuesText: string;
}

export interface VariantDraft {
  id?: string;
  options: Selection;
  sku: string;
  /** "" = use the product price */
  price: string;
  stock: string;
  is_active: boolean;
}

export const parseValues = (text: string) => [
  ...new Set(text.split(',').map(v => v.trim()).filter(Boolean)),
];

export const cleanOptions = (drafts: OptionDraft[]): ProductOption[] =>
  drafts
    .map(o => ({name: o.name.trim(), values: parseValues(o.valuesText)}))
    .filter(o => o.name && o.values.length);

const comboKey = (names: string[], combo: Selection) => JSON.stringify(names.map(n => combo[n]));

const combinations = (options: ProductOption[]): Selection[] =>
  options.reduce<Selection[]>(
    (acc, o) => acc.flatMap(combo => o.values.map(v => ({...combo, [o.name]: v}))),
    [{}],
  );

// normalize() can be missing on some Hermes builds; accents then just drop out.
const stripAccents = (s: string) =>
  typeof s.normalize === 'function' ? s.normalize('NFD').replace(/[̀-ͯ]/g, '') : s;

const skuPart = (s: string, len: number) =>
  stripAccents(s)
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, len)
    .toUpperCase();

/** "Camisa Básica" + {Color: Rojo, Talla: M} → "CAM-ROJ-M" */
export const suggestSku = (productName: string, options: {name: string}[], combo: Selection) =>
  [skuPart(productName, 3), ...options.map(o => skuPart(combo[o.name] ?? '', 3))]
    .filter(Boolean)
    .join('-');

/**
 * Rebuilds variant rows from the options: combinations that still exist keep
 * their id, SKU, price and stock; new ones get a suggested SKU.
 */
export const regenerate = (productName: string, drafts: OptionDraft[], current: VariantDraft[]) => {
  const options = cleanOptions(drafts);
  const names = options.map(o => o.name);
  const existing = new Map(current.map(v => [comboKey(names, v.options), v]));
  return combinations(options).map(
    (combo): VariantDraft =>
      existing.get(comboKey(names, combo)) ?? {
        options: combo,
        sku: suggestSku(productName, options, combo),
        price: '',
        stock: '0',
        is_active: true,
      },
  );
};

/** True when a row's combination doesn't fit the options as currently typed. */
export const isStale = (drafts: OptionDraft[], v: VariantDraft) => {
  const options = cleanOptions(drafts);
  if (Object.keys(v.options).length !== options.length) {
    return true;
  }
  return options.some(o => !o.values.includes(v.options[o.name]));
};

export const toVariantDraft = (v: Variant): VariantDraft => ({
  id: v.id,
  options: v.options,
  sku: v.sku ?? '',
  price: v.price === null ? '' : String(v.price),
  stock: String(v.stock),
  is_active: v.is_active,
});
