import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api from '../api';
import { RootState } from '../store';
import {
  CartItem, HoldStatus, Reservation, expireReservations, setReservations, setSyncing,
} from '../store/slices/cartSlice';

export type LineStatus = 'ok' | 'partial' | 'unavailable' | 'expired' | 'pending';

// What the UI should say about one cart line given the server's hold on it.
export function lineStatus(item: CartItem, r: Reservation | undefined, hold: HoldStatus): LineStatus {
  if (hold === 'expired') return 'expired';
  if (!r) return hold === 'none' ? 'pending' : 'ok';
  if (r.reserved === 0) return 'unavailable';
  if (r.reserved < item.quantity) return 'partial';
  return 'ok';
}

const signature = (items: CartItem[]) =>
  items.map((i) => `${i.product_id}:${i.quantity}`).sort((a, b) => a.localeCompare(b)).join('|');

export function useReservations() {
  const dispatch = useDispatch();
  const items = useSelector((s: RootState) => s.cart.items);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // PUT the whole cart: (re)creates holds and restarts the 3-minute timer.
  const sync = useCallback(async () => {
    const current = itemsRef.current;
    if (current.length === 0) {
      dispatch(setReservations({ items: [], expires_at: null }));
      return null;
    }
    dispatch(setSyncing(true));
    try {
      const res = await api.put('/reservations', {
        items: current.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      });
      dispatch(setReservations(res.data));
      return res.data;
    } catch {
      dispatch(setSyncing(false));
      return null;
    }
  }, [dispatch]);

  // Extend live holds without changing quantities (used while checking out).
  const renew = useCallback(async () => {
    if (itemsRef.current.length === 0) return null;
    try {
      const res = await api.post('/reservations/renew');
      if (res.data.items.length === 0) return sync(); // nothing live any more: re-reserve
      dispatch(setReservations(res.data));
      return res.data;
    } catch {
      return null;
    }
  }, [dispatch, sync]);

  const release = useCallback(async () => {
    try { await api.delete('/reservations'); } catch {}
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

// Seconds left on the cart's hold (null when there is none).
export function useHoldCountdown(): number | null {
  const holdExpiresAt = useSelector((s: RootState) => s.cart.holdExpiresAt);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!holdExpiresAt) { setLeft(null); return; }
    const tick = () => setLeft(Math.max(0, Math.round((new Date(holdExpiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [holdExpiresAt]);
  return left;
}

export const formatCountdown = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
