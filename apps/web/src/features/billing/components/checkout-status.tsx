'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { z } from 'zod';
import type { SessionFetch } from '@/lib/api/validated-response';
import { Button } from '@/components/ui/button';
import { ActionFeedback } from '@/features/shared/feedback';
import { loadOperation, operationSchema } from '../api';
import { safeCheckoutUrl } from '../presentation';
export function CheckoutStatus({
  id,
  fetchApi,
  runtime,
  autoOpen = false,
  onConfirmed,
  onExpired,
}: {
  id: string;
  fetchApi: SessionFetch;
  runtime: string;
  autoOpen?: boolean;
  onConfirmed?: () => void;
  onExpired?: () => void;
}) {
  const [operation, setOperation] = useState<z.infer<
    typeof operationSchema
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [pollingStopped, setPollingStopped] = useState(false);
  const opened = useRef(false);
  const confirmed = useRef(false);
  useEffect(() => {
    let alive = true;
    const deadline = Date.now() + 60000;
    setPollingStopped(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function poll() {
      try {
        const data = (await loadOperation(fetchApi, id)).data;
        if (!alive) return;
        setOperation(data);
        setError(null);
        if (data.paymentStatus === 'reversed') return;
        if (data.paymentStatus === 'expired') {
          if (!confirmed.current) {
            confirmed.current = true;
            onExpired?.();
          }
          return;
        }
        if (data.paymentStatus === 'confirmed') {
          if (!confirmed.current) {
            confirmed.current = true;
            onConfirmed?.();
          }
          return;
        }
        if (data.redirectUrl && autoOpen && !opened.current) {
          const url = safeCheckoutUrl(
            data.redirectUrl,
            runtime,
            window.location.origin,
          );
          opened.current = true;
          window.location.assign(url);
          return;
        }
        if (data.status !== 'review' && data.paymentStatus !== 'failed') {
          if (Date.now() < deadline)
            timer = setTimeout(() => void poll(), 3000);
          else setPollingStopped(true);
        }
      } catch {
        if (alive)
          setError(
            'No pudimos consultar la confirmación. Tu retorno del checkout no confirma un pago. Volvé a consultar.',
          );
      }
    }
    void poll();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [fetchApi, id, runtime, autoOpen, onConfirmed, onExpired, revision]);
  const expired = operation?.paymentStatus === 'expired';
  const done = operation?.paymentStatus === 'confirmed';
  const review = operation?.status === 'review';
  const failed = operation?.paymentStatus === 'failed';
  const reversed = operation?.paymentStatus === 'reversed';
  return (
    <section
      aria-label="Confirmación del pago"
      className="my-6 border border-border bg-card p-5"
    >
      <h2 className="font-caption text-2xl italic">
        {expired
          ? 'Checkout vencido'
          : reversed
            ? 'Pago revertido'
            : done
              ? 'Pago confirmado'
              : review
                ? 'Operación en revisión'
                : failed
                  ? 'El pago no fue aprobado'
                  : 'Confirmación pendiente'}
      </h2>
      <p
        className="mt-2 max-w-prose font-body text-sm text-muted-foreground"
        role="status"
      >
        {expired
          ? 'La pasarela confirmó el vencimiento sin pago. Podés volver a elegir un plan e iniciar otro checkout cuando quieras.'
          : reversed
            ? 'Se registró una devolución total o un contracargo confirmado. El período asociado fue invalidado; revisá el historial y tu acceso en Facturación.'
            : done
              ? 'El pago fue confirmado y el período de acceso está actualizado.'
              : review
                ? 'No inicies otro cobro. El operador debe reconciliar esta operación.'
                : failed
                  ? 'Revisá el historial y las opciones de la pasarela antes de volver a intentar.'
                  : 'La pasarela puede demorar en confirmar. Podés volver al panel y consultar esta operación más tarde.'}
      </p>
      {runtime === 'simulation' && !done && !reversed && !expired && (
        <p className="mt-3 text-sm">
          Entorno de simulación: el operador puede registrar el resultado desde
          el panel de plataforma. No se realizan cobros.
        </p>
      )}
      {pollingStopped && !done && !expired && (
        <p className="mt-3 text-sm" role="status">
          La confirmación sigue pendiente. Usá Consultar estado para volver a
          comprobarla.
        </p>
      )}
      {error && <ActionFeedback>{error}</ActionFeedback>}
      <div className="mt-4 flex flex-wrap gap-3">
        {expired ? (
          <Button variant="outline" asChild>
            <Link href="/admin/billing">Volver a elegir plan</Link>
          </Button>
        ) : (
          <Button variant="outline" onClick={() => setRevision((r) => r + 1)}>
            Consultar estado
          </Button>
        )}
        {operation?.redirectUrl && !done && !reversed && !expired && (
          <Button
            onClick={() => {
              try {
                window.location.assign(
                  safeCheckoutUrl(
                    operation.redirectUrl!,
                    runtime,
                    window.location.origin,
                  ),
                );
              } catch {
                setError(
                  'La dirección del checkout no es válida. Revisá la configuración con el operador.',
                );
              }
            }}
          >
            Abrir checkout seguro
          </Button>
        )}
      </div>
    </section>
  );
}
