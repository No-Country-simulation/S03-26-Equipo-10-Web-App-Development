'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';

const visible = () => document.visibilityState !== 'hidden';
type Snapshot<T> = { load: (signal: AbortSignal) => Promise<T>; enabled: boolean; data?: T; error?: unknown; refreshing: boolean };
export type PollInterval<T> = number | ((data: T | undefined) => number | null) | null;

/** Serial visible-tab reads, abort on cleanup/hide and no publication from obsolete identities or filters. */
export function useBiResource<T>(load: (signal: AbortSignal) => Promise<T>, enabled = true, interval: PollInterval<T> = null, refreshKey = 0) {
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({ load, enabled, refreshing: true });
  useEffect(() => {
    if (!enabled) return;
    let current = true; let serial = 0; let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined; let latest: T | undefined;
    async function run() {
      if (!current || document.visibilityState === 'hidden') return;
      clearTimeout(timer); controller?.abort(); controller = new AbortController();
      const request = ++serial; let stopPolling = false;
      setSnapshot(before => ({ load, enabled, ...(before.load === load && before.enabled === enabled ? { data: before.data } : {}), refreshing: true }));
      try {
        const data = await load(controller.signal);
        if (!current || request !== serial) return;
        latest = data; setSnapshot({ load, enabled, data, refreshing: false });
      } catch (error) {
        if (!current || request !== serial || controller.signal.aborted) return;
        stopPolling = error instanceof ApiError && ([400, 401, 403, 404, 429].includes(error.status ?? 0) || ['BI_DISABLED', 'BI_OPERATIONS_DISABLED', 'INVALID_RESPONSE'].includes(error.code ?? ''));
        const retain = !(error instanceof ApiError && [400, 401, 403, 404].includes(error.status ?? 0));
        setSnapshot(before => ({ load, enabled, ...(retain && before.load === load ? { data: before.data } : {}), error, refreshing: false }));
      } finally {
        if (current && request === serial && visible()) {
          const delay = typeof interval === 'function' ? interval(latest) : interval;
          if (delay !== null && !stopPolling) timer = setTimeout(() => { void run(); }, delay);
        }
      }
    }
    function visibility() {
      if (document.visibilityState === 'hidden') { clearTimeout(timer); ++serial; controller?.abort(); }
      else void run();
    }
    document.addEventListener('visibilitychange', visibility); void run();
    return () => { current = false; ++serial; clearTimeout(timer); controller?.abort(); document.removeEventListener('visibilitychange', visibility); };
  }, [load, enabled, interval, revision, refreshKey]);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  // Synchronous masking prevents even one render of another account/filter's data before effect cleanup.
  const state = snapshot.load === load && snapshot.enabled === enabled && enabled ? snapshot : { refreshing: true, data: undefined, error: undefined };
  return { ...state, loading: state.data === undefined && !state.error, reload };
}
