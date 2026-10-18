'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAnalyticsDashboard } from '../api';
import { LoadFailure } from '@/features/shared/load-failure';
import { LoadingState } from '@/features/shared/feedback';
import { useRemoteResource } from '@/features/shared/use-remote-resource';
import { testimonialLocation } from '@/features/testimonials/query';
import { timestamp } from '@/features/business-intelligence/format';

const eventLabels = {
  view: 'Visualización',
  click: 'Clic',
  play: 'Reproducción',
};
const linkClass = 'text-primary underline underline-offset-4';
export default function AnalyticsPage() {
  const { session, fetchApi } = useSession();
  const load = useCallback(
    async () => (await getAnalyticsDashboard(fetchApi)).data,
    [fetchApi],
  );
  const { state, reload } = useRemoteResource(load, Boolean(session));
  const data = state.status === 'success' ? state.data : null;
  return (
    <div className="min-w-0 font-body">
      <DashboardHeader
        title="Analítica"
        description="Interacciones registradas con los testimonios de este espacio."
      >
        <Button
          type="button"
          variant="outline"
          onClick={reload}
          disabled={state.status === 'loading'}
        >
          <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
          Actualizar métricas
        </Button>
      </DashboardHeader>
      {state.status === 'loading' ? (
        <LoadingState>Cargando métricas…</LoadingState>
      ) : state.status === 'error' ? (
        <LoadFailure
          error={state.error}
          resource="las métricas"
          onRetry={reload}
        />
      ) : (
        data && (
          <>
            <section
              aria-label="Alcance de las métricas"
              className="mb-6 space-y-2 text-sm"
            >
              <p>
                {data.period.from
                  ? `Acumulado desde el primer evento registrado: ${timestamp(data.period.from)}.`
                  : 'Acumulado de toda la actividad registrada. Todavía no hay eventos.'}
              </p>
              <p>Observado: {timestamp(data.observedAt)}.</p>
              <p className="text-muted-foreground">
                Son eventos, no personas únicas ni conversiones. La actividad
                pública puede quedar incompleta si el navegador bloquea el
                tracking.
              </p>
            </section>
            <dl className="grid gap-6 border-y py-6 sm:grid-cols-3">
              {[
                ['Visualizaciones', data.totalViews],
                ['Clics', data.totalClicks],
                ['Reproducciones', data.totalPlays],
              ].map(([label, value]) => (
                <div className="min-w-0" key={label}>
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="mt-2 break-words text-3xl font-medium tabular-nums">
                    {value.toLocaleString('es-AR')}
                  </dd>
                </div>
              ))}
            </dl>
            <section className="mt-10" aria-labelledby="recent-events">
              <h2 id="recent-events" className="text-xl font-semibold">
                Eventos recientes
              </h2>
              <p className="mb-5 mt-2 text-sm text-muted-foreground">
                Mostrando {data.events.length} de hasta {data.recentEventsLimit}{' '}
                eventos recientes, del más nuevo al más antiguo. Los totales
                incluyen toda la actividad acumulada.
              </p>
              {data.events.length === 0 ? (
                <div className="space-y-4 border border-dashed p-6">
                  <p>
                    Todavía no hay interacciones registradas. Publicá una
                    historia y compartí tu galería para empezar.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Link
                      className={linkClass}
                      href="/admin/testimonials?status=approved"
                    >
                      Revisar testimonios para publicar
                    </Link>
                    <Link className={linkClass} href="/admin/settings">
                      Configurar el enlace público
                    </Link>
                  </div>
                </div>
              ) : (
                <div
                  role="region"
                  aria-label="Eventos recientes del espacio"
                  tabIndex={0}
                  className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain [contain:inline-size]"
                >
                  <table className="w-full min-w-[38rem] text-left text-sm">
                    <caption className="sr-only">
                      Eventos recientes y testimonios asociados; fechas en UTC
                    </caption>
                    <thead>
                      <tr>
                        {['Interacción', 'Testimonio', 'Fecha UTC'].map(
                          (label) => (
                            <th
                              key={label}
                              scope="col"
                              className="border-b p-3 font-medium text-muted-foreground"
                            >
                              {label}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data.events.map((event) => (
                        <tr key={event.id} className="border-b">
                          <td className="p-3 align-top">
                            {eventLabels[event.eventType]}
                          </td>
                          <td className="max-w-sm p-3 align-top">
                            <Link
                              prefetch={false}
                              className={`${linkClass} break-words`}
                              href={testimonialLocation(
                                1,
                                {},
                                event.testimonial.id,
                              )}
                            >
                              {event.testimonial.authorName}
                            </Link>
                            <p className="mt-2 break-words text-muted-foreground">
                              {event.testimonial.excerpt}
                            </p>
                          </td>
                          <td className="whitespace-nowrap p-3 align-top">
                            <time dateTime={event.createdAt}>
                              {timestamp(event.createdAt)}
                            </time>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}
