import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import api from '../api';
import { useApiGet } from './useApiGet';

vi.mock('../api', () => ({ default: { get: vi.fn() } }));
const get = vi.mocked(api.get);

// A response the test resolves when it chooses.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  get.mockReset();
});

describe('useApiGet', () => {
  it('loads the url with its params', async () => {
    get.mockResolvedValueOnce({ data: { items: [1] } });
    const { result } = renderHook(() => useApiGet<{ items: number[] }>('/things', { page: 2, q: undefined }));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ items: [1] });
    expect(get).toHaveBeenCalledWith('/things', { params: { page: 2 } });
  });

  it('ignores a slow response to an earlier request', async () => {
    const first = deferred<{ data: string }>();
    const second = deferred<{ data: string }>();
    get.mockReturnValueOnce(first.promise as never).mockReturnValueOnce(second.promise as never);

    const { result, rerender } = renderHook(({ page }) => useApiGet<string>('/things', { page }), {
      initialProps: { page: 1 },
    });
    rerender({ page: 2 });

    await act(async () => {
      second.resolve({ data: 'page 2' });
    });
    await act(async () => {
      first.resolve({ data: 'page 1' }); // arrives last, must be dropped
    });

    expect(result.current.data).toBe('page 2');
    expect(result.current.loading).toBe(false);
  });

  it('keeps the previous data while a new request is loading', async () => {
    get.mockResolvedValueOnce({ data: 'old' });
    const { result, rerender } = renderHook(({ page }) => useApiGet<string>('/things', { page }), {
      initialProps: { page: 1 },
    });
    await waitFor(() => expect(result.current.data).toBe('old'));

    const next = deferred<{ data: string }>();
    get.mockReturnValueOnce(next.promise as never);
    rerender({ page: 2 });
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe('old');

    await act(async () => {
      next.resolve({ data: 'new' });
    });
    expect(result.current.data).toBe('new');
  });

  it('does not refetch for a new params object with the same values', async () => {
    get.mockResolvedValue({ data: 'x' });
    const { result, rerender } = renderHook(() => useApiGet<string>('/things', { page: 1 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender();
    rerender();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('reload() fetches again and setData() edits locally', async () => {
    get.mockResolvedValueOnce({ data: 1 }).mockResolvedValueOnce({ data: 2 });
    const { result } = renderHook(() => useApiGet<number>('/count'));
    await waitFor(() => expect(result.current.data).toBe(1));

    act(() => result.current.setData((n) => n + 10));
    expect(result.current.data).toBe(11);
    expect(result.current.loading).toBe(false);

    act(() => result.current.reload());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe(2));
  });

  it('reports errors and skips fetching for a null url', async () => {
    get.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useApiGet('/broken'));
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.loading).toBe(false);

    const skipped = renderHook(() => useApiGet(null));
    expect(skipped.result.current.loading).toBe(false);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
