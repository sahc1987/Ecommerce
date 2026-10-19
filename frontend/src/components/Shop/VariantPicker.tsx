import type { ProductOption, Variant } from '../../utils/pricing';
import { type Selection, unitsLeft } from '../../utils/variantSelection';

// Whether picking `value` for `option` (keeping the other choices) leads to a
// variant that exists, and whether that variant has stock.
function valueState(variants: Variant[], options: ProductOption[], selection: Selection, option: string, value: string) {
  const wanted = { ...selection, [option]: value };
  const matches = variants.filter((v) =>
    options.every((o) => !wanted[o.name] || v.options[o.name] === wanted[o.name])
  );
  return { exists: matches.length > 0, inStock: matches.some((v) => unitsLeft(v) > 0) };
}

interface Props {
  options: ProductOption[];
  variants: Variant[];
  selection: Selection;
  onChange: (next: Selection) => void;
}

// One group of radio buttons per option (Color, Talla…). Native radios keep
// keyboard and screen-reader behavior; the visible chip is the label. Values
// without stock stay selectable (so the shopper can still switch the other
// option) but are struck through and announced as out of stock.
export default function VariantPicker({ options, variants, selection, onChange }: Readonly<Props>) {
  return (
    <div className="space-y-4">
      {options.map((option, oi) => (
        <fieldset key={option.name}>
          <legend className="text-sm font-semibold text-slate-700 mb-2">
            {option.name}:{' '}
            <span className="font-normal text-slate-500">{selection[option.name] ?? 'Choose one'}</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const { exists, inStock } = valueState(variants, options, selection, option.name, value);
              const soldOut = !exists || !inStock;
              let unavailableNote = '';
              if (!exists) unavailableNote = ' (not available)';
              else if (!inStock) unavailableNote = ' (out of stock)';
              return (
                <label key={value} className="cursor-pointer">
                  <input
                    type="radio"
                    name={`option-${oi}`}
                    value={value}
                    checked={selection[option.name] === value}
                    onChange={() => onChange({ ...selection, [option.name]: value })}
                    className="peer sr-only"
                  />
                  <span
                    className={`inline-flex items-center min-w-11 justify-center px-3.5 py-2 rounded-xl border text-sm font-medium transition-colors
                      peer-checked:border-primary-600 peer-checked:bg-primary-50 peer-checked:text-primary-700
                      peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2
                      ${soldOut
                        ? 'border-dashed border-slate-200 text-slate-400 line-through'
                        : 'border-slate-200 text-slate-700 hover:border-primary-300'}`}
                  >
                    {value}
                    {unavailableNote && <span className="sr-only">{unavailableNote}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
