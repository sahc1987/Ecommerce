import { useMemo, useState } from 'react';
import { allTimeZones, browserTimeZone, zoneOffsetLabel } from '../utils/dates';

interface Props {
  value: string;
  onChange: (tz: string) => void;
  id?: string;
}

// Searchable IANA time-zone picker with a one-click "use my browser's zone".
export default function TimeZoneSelect({ value, onChange, id = 'timezone' }: Readonly<Props>) {
  const [filter, setFilter] = useState('');
  const zones = useMemo(() => allTimeZones(), []);
  const mine = browserTimeZone();

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase().replaceAll(/\s+/g, '_');
    const list = q ? zones.filter((z) => z.toLowerCase().includes(q)) : zones;
    // Keep the current value selectable even when the filter hides it.
    return list.includes(value) ? list : [value, ...list];
  }, [zones, filter, value]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        className="input"
        placeholder="Search, e.g. New York, London, Tokyo"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Search time zones"
      />
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {shown.map((z) => (
          <option key={z} value={z}>
            {z.replaceAll('_', ' ')} ({zoneOffsetLabel(z)})
          </option>
        ))}
      </select>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          Current time there:{' '}
          <span className="font-medium text-slate-600">
            {new Intl.DateTimeFormat('en-US', { timeZone: value, hour: 'numeric', minute: '2-digit', weekday: 'short' }).format(new Date())}
          </span>
        </span>
        {mine !== value && (
          <button type="button" onClick={() => onChange(mine)} className="text-primary-600 hover:underline font-medium">
            Use {mine.replaceAll('_', ' ')}
          </button>
        )}
      </div>
    </div>
  );
}
