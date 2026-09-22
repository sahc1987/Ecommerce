import {useEffect, useRef, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../store/hooks';
import {
  cartSignature,
  expireReservations,
  syncReservations,
} from '../store/slices/cartSlice';
import {restoreCartToken} from '../api/client';

/**
 * Mounted once at the root: keeps the server's stock holds in step with the
 * cart (re-syncing whenever quantities change) and flips the hold to
 * "expired" when the 3-minute window runs out.
 */
export const useReservationSync = () => {
  const dispatch = useAppDispatch();
  const items = useAppSelector(s => s.cart.items);
  const hydrated = useAppSelector(s => s.cart.hydrated);
  const holdExpiresAt = useAppSelector(s => s.cart.holdExpiresAt);
  const [tokenReady, setTokenReady] = useState(false);
  const lastSig = useRef<string | null>(null);

  useEffect(() => {
    void restoreCartToken().then(() => setTokenReady(true));
  }, []);

  const signature = cartSignature(items);
  useEffect(() => {
    if (!tokenReady || !hydrated || lastSig.current === signature) {
      return;
    }
    lastSig.current = signature;
    const t = setTimeout(() => void dispatch(syncReservations()), 250);
    return () => clearTimeout(t);
  }, [signature, tokenReady, hydrated, dispatch]);

  useEffect(() => {
    if (!holdExpiresAt) {
      return;
    }
    const ms = new Date(holdExpiresAt).getTime() - Date.now();
    if (ms <= 0) {
      dispatch(expireReservations());
      return;
    }
    const t = setTimeout(() => dispatch(expireReservations()), ms);
    return () => clearTimeout(t);
  }, [holdExpiresAt, dispatch]);
};

/** Seconds left on the cart's hold, ticking once a second (null when none). */
export const useHoldCountdown = (): number | null => {
  const holdExpiresAt = useAppSelector(s => s.cart.holdExpiresAt);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!holdExpiresAt) {
      setLeft(null);
      return;
    }
    const tick = () =>
      setLeft(Math.max(0, Math.round((new Date(holdExpiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [holdExpiresAt]);
  return left;
};

export const formatCountdown = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
