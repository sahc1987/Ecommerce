// Product options and variants while they are being edited in the admin form.
// Kept apart from VariantEditor.tsx so that file exports only the component
// (needed for React Fast Refresh).

// Form-side shapes: numbers stay strings while being edited.
export interface OptionDraft {
  name: string;
  valuesText: string; // "Rojo, Azul" — comma separated
}

export interface VariantDraft {
  id?: string;
  options: Record<string, string>;
  sku: string;
  price: string; // "" = use the product price
  stock: string;
  is_active: boolean;
}

export const MAX_OPTIONS = 3;

export const parseValues = (text: string): string[] =>
  [...new Set(text.split(',').map((v) => v.trim()).filter(Boolean))];

export const cleanOptions = (drafts: OptionDraft[]) =>
  drafts
    .map((o) => ({ name: o.name.trim(), values: parseValues(o.valuesText) }))
    .filter((o) => o.name && o.values.length);

export const comboKey = (names: string[], combo: Record<string, string>) =>
  JSON.stringify(names.map((n) => combo[n]));

// Every combination of option values, in option order.
function combinations(options: { name: string; values: string[] }[]): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (acc, o) => acc.flatMap((combo) => o.values.map((v) => ({ ...combo, [o.name]: v }))),
    [{}]
  );
}

// "Camisa Básica" + {Color: Rojo, Talla: M} → "CAM-ROJ-M"
const skuPart = (s: string, len: number) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]/g, '').slice(0, len).toUpperCase();

export function suggestSku(productName: string, options: { name: string }[], combo: Record<string, string>): string {
  return [skuPart(productName, 3), ...options.map((o) => skuPart(combo[o.name] ?? '', 3))].filter(Boolean).join('-');
}

// Rebuilds the variant rows from the options: rows whose combination still
// exists keep their id, SKU, price and stock; new combinations get a suggested
// SKU; combinations that no longer exist are dropped.
export function regenerate(
  productName: string,
  drafts: OptionDraft[],
  current: VariantDraft[]
): VariantDraft[] {
  const options = cleanOptions(drafts);
  const names = options.map((o) => o.name);
  const existing = new Map(current.map((v) => [comboKey(names, v.options), v]));
  return combinations(options).map((combo) => existing.get(comboKey(names, combo)) ?? {
    options: combo,
    sku: suggestSku(productName, options, combo),
    price: '',
    stock: '0',
    is_active: true,
  });
}

// True when a row's combination doesn't fit the options as currently typed.
export function isStale(drafts: OptionDraft[], v: VariantDraft): boolean {
  const options = cleanOptions(drafts);
  if (Object.keys(v.options).length !== options.length) return true;
  return options.some((o) => !o.values.includes(v.options[o.name]));
}
