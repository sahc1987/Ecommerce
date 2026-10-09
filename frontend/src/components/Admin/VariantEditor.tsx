import { Plus, Trash2, Wand2 } from 'lucide-react';

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

const MAX_OPTIONS = 3;

export const parseValues = (text: string): string[] =>
  [...new Set(text.split(',').map((v) => v.trim()).filter(Boolean))];

export const cleanOptions = (drafts: OptionDraft[]) =>
  drafts
    .map((o) => ({ name: o.name.trim(), values: parseValues(o.valuesText) }))
    .filter((o) => o.name && o.values.length);

const comboKey = (names: string[], combo: Record<string, string>) => JSON.stringify(names.map((n) => combo[n]));

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

interface Props {
  productName: string;
  basePrice: string;
  options: OptionDraft[];
  variants: VariantDraft[];
  onOptionsChange: (next: OptionDraft[]) => void;
  onVariantsChange: (next: VariantDraft[]) => void;
}

export default function VariantEditor({
  productName, basePrice, options, variants, onOptionsChange, onVariantsChange,
}: Readonly<Props>) {
  const parsed = cleanOptions(options);
  const stale = variants.some((v) => isStale(options, v));
  const setOption = (i: number, patch: Partial<OptionDraft>) =>
    onOptionsChange(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const setVariant = (i: number, patch: Partial<VariantDraft>) =>
    onVariantsChange(variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const totalStock = variants.reduce((n, v) => n + (Number.parseInt(v.stock, 10) || 0), 0);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {options.map((o, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] gap-2 items-end">
            <div>
              <label htmlFor={`opt-name-${i}`} className="block text-xs font-medium text-slate-600 mb-1">Option name</label>
              <input
                id={`opt-name-${i}`}
                className="input"
                placeholder="Color"
                value={o.name}
                onChange={(e) => setOption(i, { name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor={`opt-values-${i}`} className="block text-xs font-medium text-slate-600 mb-1">
                Values (comma separated)
              </label>
              <input
                id={`opt-values-${i}`}
                className="input"
                placeholder="Rojo, Azul, Verde"
                value={o.valuesText}
                onChange={(e) => setOption(i, { valuesText: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={() => onOptionsChange(options.filter((_, j) => j !== i))}
              className="h-10 w-10 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50"
              aria-label={`Remove option ${o.name || i + 1}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {options.length < MAX_OPTIONS && (
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-1.5 text-sm"
            onClick={() => onOptionsChange([...options, { name: '', valuesText: '' }])}
          >
            <Plus size={14} /> Add option
          </button>
        )}
        {parsed.length > 0 && (
          <button
            type="button"
            className="btn-secondary inline-flex items-center gap-1.5 text-sm"
            onClick={() => onVariantsChange(regenerate(productName, options, variants))}
          >
            <Wand2 size={14} /> {variants.length ? 'Update variants' : 'Generate variants'}
          </button>
        )}
      </div>

      {stale && (
        <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
          The options changed. Click “Update variants” to match them — existing stock is kept for combinations that remain.
        </p>
      )}

      {variants.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <caption className="sr-only">Variants</caption>
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                <th scope="col" className="py-2 px-1 font-medium">Variant</th>
                <th scope="col" className="py-2 px-1 font-medium">SKU</th>
                <th scope="col" className="py-2 px-1 font-medium">Price</th>
                <th scope="col" className="py-2 px-1 font-medium">Stock</th>
                <th scope="col" className="py-2 px-1 font-medium">Active</th>
                <th scope="col" className="py-2 px-1"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v, i) => {
                const label = parsed.map((o) => v.options[o.name]).filter(Boolean).join(' / ')
                  || Object.values(v.options).join(' / ');
                return (
                  <tr key={v.id ?? comboKey(Object.keys(v.options), v.options)} className="border-b border-slate-50 align-middle">
                    <td className={`py-2 px-1 whitespace-nowrap font-medium ${isStale(options, v) ? 'text-amber-600' : 'text-slate-800'}`}>
                      {label}
                    </td>
                    <td className="py-2 px-1">
                      <input
                        className="input min-w-[8rem]"
                        aria-label={`SKU for ${label}`}
                        value={v.sku}
                        onChange={(e) => setVariant(i, { sku: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-1">
                      <input
                        type="number" min="0" step="0.01"
                        className="input w-28"
                        aria-label={`Price for ${label}`}
                        placeholder={basePrice || 'Product price'}
                        value={v.price}
                        onChange={(e) => setVariant(i, { price: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-1">
                      <input
                        type="number" min="0" step="1"
                        className="input w-24"
                        aria-label={`Stock for ${label}`}
                        value={v.stock}
                        onChange={(e) => setVariant(i, { stock: e.target.value })}
                      />
                    </td>
                    <td className="py-2 px-1 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded text-primary-600"
                        aria-label={`${label} is for sale`}
                        checked={v.is_active}
                        onChange={(e) => setVariant(i, { is_active: e.target.checked })}
                      />
                    </td>
                    <td className="py-2 px-1">
                      <button
                        type="button"
                        onClick={() => onVariantsChange(variants.filter((_, j) => j !== i))}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                        aria-label={`Remove variant ${label}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-xs text-slate-500 mt-2 px-1">
            {variants.length} variants · {totalStock} units in stock · leave price empty to use the product price
          </p>
        </div>
      )}
    </div>
  );
}
