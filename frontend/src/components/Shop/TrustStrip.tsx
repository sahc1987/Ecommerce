import { ShieldCheck, Truck, RotateCcw, Banknote } from 'lucide-react';

// Only promises the store actually keeps: shipping is always free (the API
// charges none), returns follow the store's return window, and cash on
// delivery is always offered.
const perks = (returnDays: number) => [
  { icon: ShieldCheck, title: '100% Authentic Products', text: 'Direct from trusted brands' },
  { icon: Truck, title: 'Free Shipping', text: 'On every order' },
  { icon: RotateCcw, title: 'Easy Returns', text: `Within ${returnDays} days of your order` },
  { icon: Banknote, title: 'Pay on Delivery', text: 'Cash on delivery is always available' },
];

interface Props {
  /** Store Settings return window. */
  returnDays: number;
}

// Slim row of store promises above the footer.
export default function TrustStrip({ returnDays }: Readonly<Props>) {
  return (
    <section aria-label="Why shop with us" className="bg-white border-t border-slate-200 mt-10">
      <ul className="max-w-350 mx-auto px-4 sm:px-6 py-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {perks(returnDays).map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
              <Icon size={16} className="text-primary-600" aria-hidden="true" />
            </div>
            <div className="leading-tight min-w-0">
              <p className="text-xs font-semibold text-slate-900">{title}</p>
              <p className="text-xs text-slate-500">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
