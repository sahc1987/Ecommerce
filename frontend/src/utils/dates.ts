// All dates shown in the app are rendered in the store's time zone (a store
// setting), not the viewer's browser zone, so staff and customers see the
// same "placed on" day regardless of where they are.

let storeTimeZone = 'UTC';

export const setStoreTimeZone = (tz?: string | null) => {
  if (tz && isValidTimeZone(tz)) storeTimeZone = tz;
};

export const getStoreTimeZone = () => storeTimeZone;

export const isValidTimeZone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const browserTimeZone = (): string =>
  new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

// Every IANA zone the browser knows, for the settings picker.
export const allTimeZones = (): string[] => {
  const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
  const list = intl.supportedValuesOf?.('timeZone') ?? [];
  return list.length ? list : ['UTC'];
};

// "GMT-4" style suffix so the picker shows the current offset of each zone.
export const zoneOffsetLabel = (tz: string, at: Date = new Date()): string => {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName');
    return part?.value ?? '';
  } catch {
    return '';
  }
};

const toDate = (value: string | number | Date): Date | null => {
  if (value instanceof Date) return value;
  // Date-only strings (YYYY-MM-DD) are calendar days, not instants: don't shift them.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12));
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const isDateOnly = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

export function formatDate(
  value: string | number | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS
): string {
  if (value == null || value === '') return '';
  const d = toDate(value);
  if (!d) return '';
  // A calendar day renders as-is; an instant is converted into the store zone.
  const timeZone = isDateOnly(value) ? 'UTC' : storeTimeZone;
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(d);
}

export const formatDateTime = (value: string | number | Date | null | undefined): string =>
  formatDate(value, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

// YYYY-MM-DD of an instant as seen in the store zone (default: now).
export const isoDateInStoreZone = (d: Date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: storeTimeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
