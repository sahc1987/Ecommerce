import {useCallback, useEffect, useRef, useState} from 'react';
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
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const result = await runRef.current();
      if (mounted.current) {
        setData(result);
      }
    } catch (err) {
      if (mounted.current) {
        setError(errorMessage(err));
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
