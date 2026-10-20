import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
vi.mock('../api', () => ({ default: { get } }));

// The hook keeps one copy per module instance: load a fresh one per test.
async function loadHook() {
  vi.resetModules();
  return import('./useStoreSettings');
}

describe('useStoreSettings', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: { configured: true, store: { name: 'First name' } } });
  });

  it('fetches once for every component that reads it', async () => {
    const { useStoreSettings } = await loadHook();
    function Name({ id }: Readonly<{ id: string }>) {
      return <p data-testid={id}>{useStoreSettings().store?.name ?? 'loading'}</p>;
    }
    render(<><Name id="header" /><Name id="footer" /></>);
    expect(screen.getByTestId('header').textContent).toBe('loading');
    await act(async () => {});
    expect(screen.getByTestId('header').textContent).toBe('First name');
    expect(screen.getByTestId('footer').textContent).toBe('First name');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('refresh updates every reader after the settings change', async () => {
    const { useStoreSettings, refreshStoreSettings } = await loadHook();
    function Name() {
      return <p>{useStoreSettings().store?.name ?? 'loading'}</p>;
    }
    render(<Name />);
    await act(async () => {});
    get.mockResolvedValue({ data: { configured: true, store: { name: 'Renamed' } } });
    await act(() => refreshStoreSettings());
    expect(screen.getByText('Renamed')).toBeTruthy();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('a failed request reports an error and keeps the store usable as configured', async () => {
    get.mockRejectedValue(new Error('offline'));
    const { useStoreSettings } = await loadHook();
    let seen: ReturnType<typeof useStoreSettings> | undefined;
    function Probe() {
      seen = useStoreSettings();
      return null;
    }
    render(<Probe />);
    await act(async () => {});
    expect(seen).toEqual({ status: 'error', configured: true, store: null });
  });
});
