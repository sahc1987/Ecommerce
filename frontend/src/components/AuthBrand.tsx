import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import StoreLogo from './StoreLogo';
import { useStoreSettings } from '../hooks/useStoreSettings';

/** The store's real name, logo and return window (Store Settings). */
const useStore = () => useStoreSettings().store;

// Only promises the store keeps: free shipping on every order (the API charges
// none), the configured return window, cash on delivery always on offer.
const perksFor = (returnDays: number) => [
  'Free shipping on every order',
  `Returns within ${returnDays} days`,
  'Pay by cash on delivery',
];

/** Dark brand panel beside the sign-in / sign-up forms (large screens). */
export function AuthBrandPanel({ title, text }: Readonly<{ title: (storeName: string) => string; text: string }>) {
  const store = useStore();
  const name = store?.name ?? '';
  return (
    <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-slate-900 p-10 flex-col justify-between">
      <Link to="/" className="flex items-center gap-3">
        <StoreLogo logoUrl={store?.logo_url} name={name} size={36} />
        <span className="font-bold text-xl text-white tracking-tight">{name}</span>
      </Link>

      <div>
        <h2 className="text-4xl font-bold text-white leading-tight mb-3">{title(name)}</h2>
        <p className="text-slate-300 text-base leading-relaxed mb-8">{text}</p>
        <ul className="space-y-3">
          {perksFor(store?.return_window_days ?? 30).map((perk) => (
            <li key={perk} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <Check size={11} className="text-slate-300" aria-hidden="true" />
              </div>
              <span className="text-slate-300 text-sm">{perk}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-slate-400 text-xs">&copy; {new Date().getFullYear()} {name}. All rights reserved.</p>
    </div>
  );
}

/** Small store link above the form on phones and tablets. */
export function AuthBrandMark() {
  const store = useStore();
  const name = store?.name ?? '';
  return (
    <Link to="/" className="flex items-center gap-2 mb-8 lg:hidden">
      <StoreLogo logoUrl={store?.logo_url} name={name} size={32} />
      <span className="font-bold text-lg text-slate-900">{name}</span>
    </Link>
  );
}
