import { useSyncExternalStore } from 'react';
import api from '../api';
import type { StoreSettings } from '../types';
import { setStoreTimeZone } from '../utils/dates';
import { setStoreCurrency } from '../utils/pricing';

export interface StoreStatus {
  /** 'loading' until the first answer; 'error' if it couldn't be fetched. */
  status: 'loading' | 'ready' | 'error';
  /** Whether setup has been completed (assumed true until known). */
  configured: boolean;
  store: StoreSettings | null;
}

// One copy of GET /setup/status for the whole app: layouts, pages and the
// sign-in panel all read it here instead of each fetching their own.
let snapshot: StoreStatus = { status: 'loading', configured: true, store: null };
let request: Promise<void> | null = null;
const listeners = new Set<() => void>();

function load(force = false): Promise<void> {
  if (request !== null && !force) return request;
  request = api.get<{ configured: boolean; store: StoreSettings | null }>('/setup/status').then(
    (res) => {
      // Before anyone re-renders, so every date and amount is shown in the
      // store's zone and currency.
      setStoreTimeZone(res.data.store?.timezone);
      setStoreCurrency(res.data.store?.currency);
      snapshot = { status: 'ready', configured: res.data.configured, store: res.data.store };
    },
    () => {
      snapshot = { ...snapshot, status: 'error' };
      request = null; // try again on the next subscriber
    },
  ).finally(() => listeners.forEach((notify) => notify()));
  return request;
}

/** Refetch after the settings change (setup wizard, Store Settings, logo). */
export const refreshStoreSettings = () => load(true);

function subscribe(notify: () => void) {
  listeners.add(notify);
  void load();
  return () => {
    listeners.delete(notify);
  };
}

/** Store name, logo, contact details, tax and return window from Store Settings. */
export function useStoreSettings(): StoreStatus {
  return useSyncExternalStore(subscribe, () => snapshot);
}
