'use client';
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { SessionFetch } from '@/lib/api/validated-response';
import { useRemoteResource } from '@/features/shared/use-remote-resource';
import {
  loadEntitlements,
  quotaNames,
  type BillingSummary,
  type Quota,
} from '../api';
import { accessLabels } from '../presentation';
const BillingContext = createContext<BillingSummary | null>(null);
export const useBillingScope = () => useContext(BillingContext);
export function BillingScope({
  fetchApi,
  enabled,
  children,
}: {
  fetchApi: SessionFetch;
  enabled: boolean;
  children: ReactNode;
}) {
  const path = usePathname();
  const load = useCallback(async () => {
    void path;
    return (await loadEntitlements(fetchApi)).data;
  }, [fetchApi, path]);
  const { state, reload } = useRemoteResource(load, enabled);
  useEffect(() => {
    window.addEventListener('billing:refresh', reload);
    const timer = setInterval(reload, 30000);
    return () => {
      window.removeEventListener('billing:refresh', reload);
      clearInterval(timer);
    };
  }, [reload]);
  return (
    <BillingContext.Provider
      value={state.status === 'success' ? state.data : null}
    >
      {children}
    </BillingContext.Provider>
  );
}
export function BillingNotice() {
  const billing = useBillingScope();
  if (!billing || !billing.enforcementEnabled) return null;
  return (
    <aside
      aria-label="Estado de la suscripción"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-border bg-card p-4 font-body text-sm"
    >
      <span>
        <strong>{accessLabels[billing.access.mode]}</strong>
        {!billing.access.canMutate &&
          ' · Conservás la consulta, el contenido publicado y la revocación de credenciales.'}
      </span>
      <Link
        className="underline underline-offset-4 focus-visible:outline"
        href="/admin/billing"
      >
        Ver facturación
      </Link>
    </aside>
  );
}
export function BillingQuotaNote({ quota }: { quota: Quota }) {
  const s = useBillingScope();
  if (!s?.enforcementEnabled || !s.usage) return null;
  const limit = s.quotas[quota];
  const used = s.usage[quota];
  return (
    <p className="mt-2 font-body text-xs text-muted-foreground" role="status">
      {quotaNames[quota]}:{' '}
      <span className="tabular-nums">
        {used} / {limit === null ? 'sin límite' : limit}
      </span>
      {limit !== null && used >= limit
        ? ' · El límite impide nuevas altas; tus datos se conservan.'
        : ''}
    </p>
  );
}
