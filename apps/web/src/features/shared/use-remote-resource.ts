'use client';

import { useCallback, useEffect, useState } from 'react';

export type RemoteState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; data: T };

/** Keeps results from an obsolete page, route or session out of the current view. */
export function useRemoteResource<T>(load: () => Promise<T>, enabled: boolean) {
  const [revision, setRevision] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    load: typeof load;
    enabled: boolean;
    revision: number;
    state: RemoteState<T>;
  }>({ load, enabled, revision, state: { status: 'loading' } });

  useEffect(() => {
    if (!enabled) {
      setSnapshot({ load, enabled, revision, state: { status: 'loading' } });
      return;
    }
    let current = true;
    setSnapshot({ load, enabled, revision, state: { status: 'loading' } });
    void load().then(data => {
      if (current) setSnapshot({ load, enabled, revision, state: { status: 'success', data } });
    }).catch(error => {
      if (current) setSnapshot({ load, enabled, revision, state: { status: 'error', error } });
    });
    return () => { current = false; };
  }, [enabled, load, revision]);

  const reload = useCallback(() => setRevision(value => value + 1), []);
  const state: RemoteState<T> = snapshot.load === load && snapshot.enabled === enabled && snapshot.revision === revision
    ? snapshot.state
    : { status: 'loading' };
  return { state, reload };
}
