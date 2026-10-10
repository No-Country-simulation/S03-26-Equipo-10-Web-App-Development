'use client';

import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import type { SessionFetch } from '@/lib/api/validated-response';
import { cancelBiRequest, createBiRequest } from './operations-api';
import type { RequestInput } from './operations-schemas';
export type BiCommand = { type: 'create'; input: RequestInput } | { type: 'cancel'; id: string };

/** Keys live only in this identity's mounted workspace; ambiguous responses reuse the exact intent/key. */
export function useBiCommand(fetchApi: SessionFetch, onSuccess: (result: { type: 'create' | 'cancel'; id: string }) => void, onSettled: () => void) {
  const alive = useRef(true); const locked = useRef(false);
  const intent = useRef<{ command: BiCommand; key: string } | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(); const [uncertain, setUncertain] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function execute(command: BiCommand) {
    if (locked.current || !alive.current) return;
    if (intent.current && JSON.stringify(intent.current.command) !== JSON.stringify(command)) return;
    locked.current = true; setBusy(true); setError(undefined);
    try {
      const saved = intent.current ?? { command, key: crypto.randomUUID() }; intent.current = saved;
      const response = command.type === 'create' ? await createBiRequest(fetchApi, command.input, saved.key)
        : await cancelBiRequest(fetchApi, command.id, saved.key);
      if (alive.current) { intent.current = null; setUncertain(false); onSuccess({ type: command.type, id: response.data.id }); }
    } catch (failure) {
      if (!alive.current) return;
      const ambiguous = !(failure instanceof ApiError) || failure.code === 'INVALID_RESPONSE' || (failure.status ?? 500) >= 500;
      if (!ambiguous) intent.current = null;
      setUncertain(ambiguous); setError(failure);
    } finally {
      locked.current = false;
      if (alive.current) { setBusy(false); onSettled(); }
    }
  }
  return { busy, error, uncertain, execute, repeat: () => { if (intent.current) void execute(intent.current.command); } };
}
