import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useDispatch, useSelector, useStore } from 'react-redux';
import api from '../api';
import { RootState } from '../store';
import {
  CartItem, HoldStatus, Reservation, expireReservations, lineKey, setReservations, setSyncing,
} from '../store/slices/cartSlice';

export type LineStatus = 'ok' | 'partial' | 'unavailable' | 'needs_option' | 'expired' | 'pending';

// What the UI should say about one cart line given the server's hold on it.
export function lineStatus(item: CartItem, r: Reservation | undefined, hold: HoldStatus): LineStatus {
  if (r?.needsOption) return 'needs_option';
  if (hold === 'expired') return 'expired';
  if (!r) return hold === 'none' ? 'pending' : 'ok';
  if (r.reserved === 0) return 'unavailable';
  if (r.reserved < item.quantity) return 'partial';
  return 'ok';
}

// Request body line for /reservations and /payments/place-order.
export const toOrderLine = (i: CartItem) =>
  i.variant_id ? { variant_id: i.variant_id, quantity: i.quantity } : { product_id: i.product_id, quantity: i.quantity };

const signature = (items: CartItem[]) =>
  items.map((i) => `${lineKey(i)}:${i.quantity}`).sort((a, b) => a.localeCompare(b)).join('|');

export function useReservations() {
  const dispatch = useDispatch();
  const store = useStore<RootState>();
  const items = useSelector((s: RootState) => s.cart.items);
  // The callbacks read the cart when they run (they're also called from timers),
  // not the one from the render that created them.
  const currentItems = useCallback(() => store.getState().cart.items, [store]);

  // PUT the whole cart: (re)creates holds and restarts the 3-minute timer.
  const sync = useCallback(async () => {
    const current = currentItems();
    if (current.length === 0) {
      dispatch(setReservations({ items: [], expires_at: null }));
      return null;
    }
    dispatch(setSyncing(true));
    try {
      const res = await api.put('/reservations', {
        items: current.map(toOrderLine),
      });
      dispatch(setReservations(res.data));
      return res.data;
    } catch {
      dispatch(setSyncing(false));
      return null;
    }
  }, [dispatch, currentItems]);

  // Extend live holds without changing quantities (used while checking out).
  const renew = useCallback(async () => {
    if (currentItems().length === 0) return null;
    try {
      const res = await api.post('/reservations/renew');
      if (res.data.items.length === 0) return sync(); // nothing live any more: re-reserve
      dispatch(setReservations(res.data));
      return res.data;
    } catch {
      return null;
    }
  }, [dispatch, sync, currentItems]);

  const release = useCallback(async () => {
    try {
      await api.delete('/reservations');
    } catch {
      // The server expires unused holds after 3 minutes anyway.
    }
    dispatch(setReservations({ items: [], expires_at: null }));
  }, [dispatch]);

  return { sync, renew, release, signature: signature(items) };
}

// Mounted once in the shop layout: keeps server holds in step with the cart and
// flips the hold to "expired" when the timer runs out.
export function useReservationSync() {
  const dispatch = useDispatch();
  const { sync, signature } = useReservations();
  const holdExpiresAt = useSelector((s: RootState) => s.cart.holdExpiresAt);
  const lastSig = useRef<string | null>(null);

  useEffect(() => {
    if (lastSig.current === signature) return;
    lastSig.current = signature;
    const t = setTimeout(sync, 250); // debounce rapid +/- clicks
    return () => clearTimeout(t);
  }, [signature, sync]);

  useEffect(() => {
    if (!holdExpiresAt) return;
    const ms = new Date(holdExpiresAt).getTime() - Date.now();
    if (ms <= 0) { dispatch(expireReservations()); return; }
    const t = setTimeout(() => dispatch(expireReservations()), ms);
    return () => clearTimeout(t);
  }, [holdExpiresAt, dispatch]);
}

// The clock as an external store: the current second, re-read every second
// while something is subscribed.
const subscribeEverySecond = (onTick: () => void) => {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
};
const subscribeNever = () => () => {};
const currentSecond = () => Math.floor(Date.now() / 1000);

// Seconds left on the cart's hold (null when there is none).
export function useHoldCountdown(): number | null {
  const holdExpiresAt = useSelector((s: RootState) => s.cart.holdExpiresAt);
  // Only tick while there's a hold to count down.
  const now = useSyncExternalStore(holdExpiresAt ? subscribeEverySecond : subscribeNever, currentSecond);
  if (!holdExpiresAt) return null;
  return Math.max(0, Math.round(new Date(holdExpiresAt).getTime() / 1000 - now));
}

export const formatCountdown = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
