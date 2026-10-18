'use client';

import { useCallback, useState } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { TestimonialRecord } from '@/lib/api';
import Link from 'next/link';
import { MessageSquareQuote } from 'lucide-react';
import { RatingDisplay } from '@/features/shared/rating-display';
import { cn } from '@/lib/utils';
import { TestimonialModal } from '@/features/testimonials';
import { testimonialStatusLabels } from '@/features/testimonials/presentation';
import {
  getTestimonialSummary,
  listTestimonials,
} from '@/features/testimonials/api';
import { listUsers } from '@/features/users/api';
import { LoadFailure } from '@/features/shared/load-failure';
import { LoadingState } from '@/features/shared/feedback';
import { GettingStarted } from '../components/getting-started';
import { useWorkspaceIdentity } from '@/features/shared/workspace-identity';
import { useRemoteResource } from '@/features/shared/use-remote-resource';

export default function AdminOverviewPage() {
  const { session, fetchApi, isAdmin } = useSession();
  const identity = useWorkspaceIdentity();
  const [selectedTestimonial, setSelectedTestimonial] =
    useState<TestimonialRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    const [summary, recent, pending, users] = await Promise.all([
      getTestimonialSummary(fetchApi),
      listTestimonials(fetchApi, 1, {}, 6),
      listTestimonials(fetchApi, 1, { status: 'pending' }, 6),
      isAdmin ? listUsers(fetchApi) : Promise.resolve(null),
    ]);
    return {
      summary: summary.data,
      testimonials: recent.data.items,
      pending: pending.data.items,
      userTotal: users?.data.meta.total,
    };
  }, [fetchApi, isAdmin]);
  const { state, reload } = useRemoteResource(load, Boolean(session));
  const testimonials: TestimonialRecord[] =
    state.status === 'success' ? state.data.testimonials : [];

  return (
    <>
      <DashboardHeader
        title={`Bienvenido, ${session?.user.email.split('@')[0] ?? ''}`}
        description={`Espacio: ${identity?.name ?? session?.user.tenantName ?? '—'} · ${isAdmin ? 'Administración' : 'Edición'}`}
      />

      {isAdmin && (
        <GettingStarted
          fetchApi={fetchApi}
          summary={state.status === 'success' ? state.data.summary : undefined}
        />
      )}
      {state.status === 'loading' ? (
        <LoadingState>Cargando métricas del inicio…</LoadingState>
      ) : state.status === 'error' ? (
        <LoadFailure
          error={state.error}
          resource="el resumen"
          onRetry={reload}
        />
      ) : (
        <>
          <section aria-labelledby="review-heading" className="border-y py-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 id="review-heading" className="font-display text-2xl">
                  {state.data.summary.byStatus.pending > 0
                    ? `${state.data.summary.byStatus.pending} pendientes de revisión`
                    : 'La revisión está al día'}
                </h2>
                <p className="mt-2 font-body text-sm text-muted-foreground">
                  Aprobá el contenido que corresponda; publicarlo requiere un
                  paso más.
                </p>
              </div>
              <Link
                className="inline-flex min-h-11 items-center bg-primary px-4 font-body text-sm text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                href="/admin/testimonials?status=pending"
              >
                Revisar pendientes
              </Link>
            </div>
            {state.data.pending.length > 0 && (
              <ul className="mt-6 divide-y">
                {state.data.pending.map((record) => (
                  <li key={record.id}>
                    <Link
                      href={`/admin/testimonials?status=pending&testimonial=${encodeURIComponent(record.id)}`}
                      className="block py-4 font-body hover:bg-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="block text-sm font-medium">
                        {record.authorName}
                      </span>
                      <span className="mt-1 block truncate text-sm text-muted-foreground">
                        {record.content}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {state.data.pending.length > 0 && (
              <p className="mt-3 font-body text-sm text-muted-foreground">
                Hasta 6 pendientes más recientes de todo el espacio.
              </p>
            )}
            <p className="mt-5 font-body text-sm">
              <Link
                href="/admin/testimonials?status=draft"
                className="inline-flex min-h-11 items-center underline underline-offset-4"
              >
                Preparar borradores ({state.data.summary.byStatus.draft})
              </Link>{' '}
              · Los borradores todavía no están en revisión.
            </p>
          </section>
          <section aria-labelledby="summary-heading" className="mt-8">
            <h2
              id="summary-heading"
              className="font-body text-base font-medium"
            >
              Todo el espacio
            </h2>
            <p className="mt-2 font-body text-sm text-muted-foreground">
              Totales globales, independientemente de las listas recientes.
            </p>
            <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-4 border-y py-5 font-body text-sm tabular-nums">
              <div>
                <dt>Total de testimonios</dt>
                <dd className="mt-1 font-semibold">
                  {state.data.summary.total}
                </dd>
              </div>
              {Object.entries(state.data.summary.byStatus).map(
                ([status, count]) => (
                  <div key={status}>
                    <dt>
                      <Link
                        className="underline underline-offset-4"
                        href={`/admin/testimonials?status=${status}`}
                      >
                        {testimonialStatusLabels[status]}
                      </Link>
                    </dt>
                    <dd className="mt-1 font-semibold">{count}</dd>
                  </div>
                ),
              )}
              {isAdmin && (
                <div>
                  <dt>Usuarios</dt>
                  <dd className="mt-1 font-semibold">{state.data.userTotal}</dd>
                </div>
              )}
            </dl>
          </section>

          {/* Recent Testimonials */}
          <div className="mt-12">
            <h2 className="mb-6 font-body text-xs font-bold uppercase tracking-widest text-foreground">
              Testimonios recientes
            </h2>
            <p className="mb-4 font-body text-sm text-muted-foreground">
              Hasta 6 testimonios más recientes, de cualquier estado.
            </p>
            {testimonials.length === 0 ? (
              <div className="border border-dashed p-12 text-center">
                <MessageSquareQuote className="mx-auto mb-4 h-8 w-8 text-muted-foreground/30" />
                <p className="font-body text-sm text-muted-foreground">
                  No hay testimonios todavía para este espacio.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {testimonials.slice(0, 6).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setSelectedTestimonial(t);
                      setModalOpen(true);
                    }}
                    className="border bg-card p-6 text-left transition-all duration-300 hover:scale-[1.02] hover:bg-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transform-none"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-body text-sm font-bold uppercase tracking-wider text-foreground">
                        {t.authorName}
                      </span>
                      <span
                        className={cn(
                          'px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider',
                          t.status === 'published' &&
                            'bg-primary/10 text-primary',
                          t.status === 'pending' &&
                            'bg-warning/10 text-warning',
                          t.status === 'draft' &&
                            'bg-muted text-muted-foreground',
                          t.status === 'approved' &&
                            'bg-success/10 text-success',
                          t.status === 'rejected' &&
                            'bg-destructive/10 text-destructive',
                        )}
                      >
                        {testimonialStatusLabels[t.status] ?? t.status}
                      </span>
                    </div>
                    <p className="font-caption text-sm italic leading-relaxed text-muted-foreground line-clamp-3">
                      &ldquo;{t.content}&rdquo;
                    </p>
                    <RatingDisplay rating={t.rating} className="mt-4" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <TestimonialModal
        testimonial={selectedTestimonial}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setSelectedTestimonial(null);
        }}
        onDeleted={() => {
          setModalOpen(false);
          setSelectedTestimonial(null);
          reload();
        }}
        onUpdated={(updated) => {
          setSelectedTestimonial(updated);
          reload();
        }}
      />
    </>
  );
}
