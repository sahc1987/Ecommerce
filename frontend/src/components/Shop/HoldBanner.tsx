import { useSelector } from 'react-redux';
import { Timer, AlertTriangle, RefreshCw } from 'lucide-react';
import { RootState } from '../../store';
import { formatCountdown, lineStatus, useHoldCountdown, useReservations } from '../../hooks/useReservations';

interface Props {
  compact?: boolean;
}

// Shows how long the cart's stock is held, or what went wrong with the hold.
export default function HoldBanner({ compact = false }: Readonly<Props>) {
  const { items, reservations, holdStatus, syncing } = useSelector((s: RootState) => s.cart);
  const left = useHoldCountdown();
  const { sync } = useReservations();

  if (items.length === 0) return null;

  const problems = items.filter((i) => ['partial', 'unavailable'].includes(lineStatus(i, reservations[i.product_id], holdStatus)));
  const pad = compact ? 'px-3 py-2 text-[11px]' : 'px-4 py-3 text-sm';

  if (holdStatus === 'expired') {
    return (
      <div className={`flex items-center justify-between gap-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 ${pad}`}>
        <span className="flex items-center gap-2"><AlertTriangle size={compact ? 13 : 16} /> Your hold expired — items may have sold out.</span>
        <button
          type="button"
          onClick={sync}
          disabled={syncing}
          className="flex items-center gap-1 font-semibold text-amber-900 hover:underline disabled:opacity-50 whitespace-nowrap"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} /> Reserve again
        </button>
      </div>
    );
  }

  if (problems.length > 0) {
    return (
      <div className={`rounded-xl bg-rose-50 border border-rose-200 text-rose-700 ${pad}`}>
        <span className="flex items-center gap-2 font-semibold"><AlertTriangle size={compact ? 13 : 16} /> Some items are no longer available</span>
        {!compact && (
          <ul className="mt-1 ml-6 list-disc text-xs">
            {problems.map((i) => {
              const r = reservations[i.product_id];
              return (
                <li key={i.product_id}>
                  {i.name}: {r?.reserved ? `only ${r.reserved} available` : 'out of stock'} — reduce the quantity or remove it.
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  if (left === null) return null;

  return (
    <div className={`flex items-center gap-2 rounded-xl bg-primary-50 border border-primary-100 text-primary-800 ${pad}`}>
      <Timer size={compact ? 13 : 16} className="text-primary-600" />
      <span>
        Items reserved for <span className="font-bold tabular-nums">{formatCountdown(left)}</span>
        {!compact && <span className="text-primary-600/80"> — complete checkout to keep them.</span>}
      </span>
    </div>
  );
}
