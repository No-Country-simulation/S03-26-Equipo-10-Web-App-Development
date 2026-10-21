'use client';
import { useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { LoadingState, ActionFeedback } from '@/features/shared/feedback';
import { useRemoteResource } from '@/features/shared/use-remote-resource';
import { LoadFailure } from '@/features/shared/load-failure';
import { loadSummary } from '../api';
import { CheckoutStatus } from '../components/checkout-status';
export default function BillingReturnScreen() {
  const { session, fetchApi, isAdmin } = useSession();
  const params = useSearchParams();
  const id = params.get('operation');
  const confirmed = useCallback(
    () => window.dispatchEvent(new Event('billing:refresh')),
    [],
  );
  const load = useCallback(
    async () => (await loadSummary(fetchApi)).data,
    [fetchApi],
  );
  const { state, reload } = useRemoteResource(load, !!session && isAdmin);
  return (
    <>
      <DashboardHeader
        title="Confirmación del pago"
        description="Consultamos la confirmación del pago. Volver de la pasarela no acredita el pago."
      />
      {!isAdmin ? (
        <ActionFeedback kind="info">
          El administrador del espacio puede consultar esta operación.
        </ActionFeedback>
      ) : !id || !/^[a-f0-9-]{36}$/i.test(id) ? (
        <ActionFeedback>
          El enlace no contiene una operación válida. Consultá el historial de
          facturación.
        </ActionFeedback>
      ) : state.status === 'loading' ? (
        <LoadingState />
      ) : state.status === 'error' ? (
        <LoadFailure
          error={state.error}
          resource="la operación"
          onRetry={reload}
        />
      ) : (
        <CheckoutStatus
          key={id}
          id={id}
          fetchApi={fetchApi}
          runtime={state.data.runtime}
          onConfirmed={confirmed}
        />
      )}
      <Button variant="outline" asChild>
        <Link href="/admin/billing">Volver a facturación</Link>
      </Button>
    </>
  );
}
