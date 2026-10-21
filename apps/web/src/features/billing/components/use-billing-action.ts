'use client';
import { useRef, useState } from 'react';
import type { SessionFetch } from '@/lib/api/validated-response';
import { billingMutation } from '../api';
import { actionFailureCopy } from '@/features/shared/load-failure';
export function useBillingAction(fetchApi: SessionFetch) {
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);
  async function execute(path: string, payload: unknown, method = 'POST') {
    if (lock.current) throw Error('Ya hay una operación en curso.');
    const signature = JSON.stringify([path, payload, method]);
    if (attempt.current?.signature !== signature)
      attempt.current = { signature, key: crypto.randomUUID() };
    lock.current = true;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await billingMutation(
        fetchApi,
        path,
        payload,
        attempt.current.key,
        method,
      );
      attempt.current = null;
      return response.data;
    } catch (error) {
      setFeedback({
        kind: 'error',
        text: actionFailureCopy(error, 'la operación de facturación'),
      });
      throw error;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { execute, busy, feedback, setFeedback };
}
