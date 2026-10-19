import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {errorMessage} from '../api/client';

interface Options {
  /** Re-run every time the screen regains focus (default: true). */
  refetchOnFocus?: boolean;
}

/**
 * Standard load / refresh / error lifecycle for a screen that reads from the
 * API. `run` is expected to be memoised by the caller.
 */
export function useAsync<T>(
  run: () => Promise<T>,
  deps: unknown[],
  options: Options = {},
) {
  const {refetchOnFocus = true} = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  // The latest `run`, updated after each render (before the effects below use it).
  const runRef = useRef(run);
  useLayoutEffect(() => {
    runRef.current = run;
  });
  // Only the most recent load may apply its result, so a slow earlier response
  // can't overwrite a newer one (e.g. when `deps` change quickly).
  const latest = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    const id = ++latest.current;
    const current = () => mounted.current && id === latest.current;
    if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await runRef.current();
      if (current()) {
        setData(result);
      }
    } catch (err) {
      if (current()) {
        setError(errorMessage(err));
      }
    } finally {
      if (current()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void load('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (!refetchOnFocus) {
        return;
      }
      // The mount effect already loaded once; skip the duplicate focus fire.
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void load('refresh');
    }, [load, refetchOnFocus]),
  );

  const refresh = useCallback(() => load('refresh'), [load]);

  return {data, setData, loading, refreshing, error, refresh, reload: load};
}
