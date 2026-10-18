'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { z } from 'zod';
import type { SessionFetch } from '@/lib/api/validated-response';
import { getTenant } from '@/features/settings/api';
import { testimonialSummarySchema } from '@/features/testimonials/api';
import { useRemoteResource } from '@/features/shared/use-remote-resource';
import { LoadingState } from '@/features/shared/feedback';
import { LoadFailure } from '@/features/shared/load-failure';

type Summary = z.infer<typeof testimonialSummarySchema>;
const linkClass =
  'inline-flex min-h-11 items-center text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

export function GettingStarted({
  fetchApi,
  summary,
}: {
  fetchApi: SessionFetch;
  summary?: Summary;
}) {
  const load = useCallback(
    async () => (await getTenant(fetchApi)).data,
    [fetchApi],
  );
  const { state, reload } = useRemoteResource(load, true);
  return (
    <details
      className="mb-8 border-y font-body"
      open={summary?.total === 0 ? true : undefined}
    >
      <summary className="cursor-pointer py-5 text-base font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
        Primeros pasos con tu espacio (opcional)
      </summary>
      <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
        Podés seguir trabajando y volver a este recorrido cuando lo necesites.
        Los estados reflejan los datos actuales; copiar un enlace no confirma
        que lo hayas compartido.
      </p>
      {state.status === 'loading' ? (
        <LoadingState>Cargando estado del espacio…</LoadingState>
      ) : state.status === 'error' ? (
        <LoadFailure
          error={state.error}
          resource="el recorrido de inicio"
          onRetry={reload}
        />
      ) : (
        <ol className="mb-5 divide-y">
          <li className="py-4">
            <h3 className="text-base font-medium">Configurá tu identidad</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Nombre actual: {state.data.name}. El logo es opcional.
            </p>
            <Link className={linkClass} href="/admin/settings#brand">
              Editar nombre y logo
            </Link>
          </li>
          <li className="py-4">
            <h3 className="text-base font-medium">Compartí la captura</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {state.data.publicSlug
                ? `Enlace configurado. Recepción ${state.data.isPublicFormEnabled ? 'abierta: podés recibir nuevos envíos.' : 'cerrada: no acepta nuevos envíos.'}`
                : 'Falta configurar el enlace público.'}
            </p>
            <Link className={linkClass} href="/admin/settings#capture">
              Configurar y copiar enlace
            </Link>
          </li>
          <li className="py-4">
            <h3 className="text-base font-medium">Revisá los testimonios</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {summary
                ? `${summary.byStatus.pending} pendientes de revisión · ${summary.byStatus.draft} borradores sin enviar a revisión.`
                : 'El resumen todavía no está disponible. Podés abrir la revisión.'}
            </p>
            <Link
              className={linkClass}
              href="/admin/testimonials?status=pending"
            >
              Abrir revisión
            </Link>
          </li>
          <li className="py-4">
            <h3 className="text-base font-medium">
              Publicá y consultá la galería
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {summary
                ? `${summary.byStatus.approved} aprobados sin publicar · ${summary.byStatus.published} publicados.`
                : 'Aprobá un testimonio antes de publicarlo.'}{' '}
              Aprobar y publicar son pasos separados.
            </p>
            <div className="flex flex-wrap gap-x-5">
              <Link
                className={linkClass}
                href="/admin/testimonials?status=approved"
              >
                Revisar aprobados
              </Link>
              {state.data.publicSlug && (
                <Link
                  className={linkClass}
                  href={`/t/${state.data.publicSlug}`}
                >
                  Ver galería pública
                </Link>
              )}
            </div>
          </li>
        </ol>
      )}
    </details>
  );
}
