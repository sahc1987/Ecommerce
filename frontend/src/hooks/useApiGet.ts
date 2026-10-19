import { useCallback, useEffect, useState } from 'react';
import api from '../api';

type Params = Record<string, string | number | boolean | undefined>;

interface Loaded<T> {
  /** Which request (url + params + reload count) this result answers. */
  request: string;
  data?: T;
  error?: unknown;
}

/**
 * GETs `url` with `params` and refetches whenever either changes. Responses to
 * an earlier request are dropped, so quickly switching filters or pages can't
 * show a stale list. Pass `null` as the url to skip fetching.
 *
 * While a new request is in flight, `data` still holds the previous result and
 * `loading` is true.
 */
export function useApiGet<T>(url: string | null, params: Params = {}) {
  // Stable string form of the request, so a new params object with the same
  // values doesn't refetch. Undefined values are dropped, as axios does.
  const paramsKey = JSON.stringify(params);
  const [reloads, setReloads] = useState(0);
  const request = `${url}?${paramsKey}#${reloads}`;
  const [loaded, setLoaded] = useState<Loaded<T>>({ request: '' });

  useEffect(() => {
    if (url === null) return;
    let ignore = false;
    api.get<T>(url, { params: JSON.parse(paramsKey) as Params }).then(
      (res) => {
        if (!ignore) setLoaded({ request, data: res.data });
      },
      (error: unknown) => {
        if (!ignore) setLoaded((prev) => ({ request, data: prev.data, error }));
      },
    );
    return () => {
      ignore = true;
    };
  }, [url, paramsKey, request]);

  const reload = useCallback(() => setReloads((n) => n + 1), []);

  // Local edits after a successful save, without refetching.
  const setData = useCallback(
    (update: (data: T) => T) =>
      setLoaded((prev) => (prev.data === undefined ? prev : { ...prev, data: update(prev.data) })),
    [],
  );

  return {
    data: loaded.data,
    error: loaded.request === request ? loaded.error : undefined,
    loading: url !== null && loaded.request !== request,
    reload,
    setData,
  };
}
