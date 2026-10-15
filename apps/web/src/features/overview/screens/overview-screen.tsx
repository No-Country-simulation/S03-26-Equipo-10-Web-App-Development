'use client';

import { useCallback, useState } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { TestimonialRecord, TenantUser } from '@/lib/api';
import { MessageSquareQuote, Users, Clock, TrendingUp } from 'lucide-react';
import { RatingDisplay } from '@/features/shared/rating-display';
import { cn } from '@/lib/utils';
import { TestimonialModal } from '@/features/testimonials';
import { testimonialStatusLabels } from '@/features/testimonials/presentation';
import { listTestimonials } from '@/features/testimonials/api';
import { listUsers } from '@/features/users/api';
import { LoadFailure } from '@/features/shared/load-failure';
import { LoadingState } from '@/features/shared/feedback';
import { useRemoteResource } from '@/features/shared/use-remote-resource';

export default function AdminOverviewPage() {
  const { session, fetchApi, isAdmin } = useSession();
  const [selectedTestimonial, setSelectedTestimonial] =
    useState<TestimonialRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    const [tRes, uRes] = await Promise.all([
      listTestimonials(fetchApi),
      isAdmin
        ? listUsers(fetchApi)
        : Promise.resolve({
            data: { items: [] as TenantUser[], meta: { total: 0 } },
            success: true,
          }),
    ]);
    return {
      testimonials: tRes.data.items,
      testimonialTotal: tRes.data.meta.total,
      userTotal: uRes.data.meta.total,
    };
  }, [fetchApi, isAdmin]);
  const { state, reload } = useRemoteResource(load, Boolean(session));
  const testimonials: TestimonialRecord[] =
    state.status === 'success' ? state.data.testimonials : [];
  const testimonialTotal =
    state.status === 'success' ? state.data.testimonialTotal : 0;
  const userTotal = state.status === 'success' ? state.data.userTotal : 0;

  const pending = testimonials.filter(
    (t) => t.status === 'pending' || t.status === 'draft',
  ).length;
  const published = testimonials.filter((t) => t.status === 'published').length;

  const metrics = [
    {
      label: 'Total Testimonios',
      value: testimonialTotal,
      icon: MessageSquareQuote,
      accent: false,
    },
    {
      label: 'Publicados recientes',
      value: published,
      icon: TrendingUp,
      accent: false,
    },
    {
      label: 'Pendientes recientes',
      value: pending,
      icon: Clock,
      accent: pending > 0,
    },
    ...(isAdmin
      ? [
          {
            label: 'Usuarios',
            value: userTotal,
            icon: Users,
            accent: false,
          },
        ]
      : []),
  ];

  return (
    <>
      <DashboardHeader
        title={`Bienvenido, ${session?.user.email.split('@')[0] ?? ''}`}
        description={`Tenant: ${session?.user.tenantName ?? '—'} · Rol: ${session?.user.roles.join(', ') ?? '—'}`}
      />

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
          {/* Metric Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.map((m) => (
              <div
                key={m.label}
                className={cn(
                  'group border p-6 transition-colors hover:bg-card',
                  m.accent && 'border-primary/40 bg-primary/5',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {m.label}
                  </span>
                  <m.icon
                    className={cn(
                      'h-4 w-4',
                      m.accent ? 'text-primary' : 'text-muted-foreground/50',
                    )}
                  />
                </div>
                <p className="mt-3 font-body tabular-nums text-4xl font-medium text-foreground">
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* Recent Testimonials */}
          <div className="mt-12">
            <h2 className="mb-6 font-body text-xs font-bold uppercase tracking-widest text-foreground">
              Testimonios Recientes
            </h2>
            {testimonials.length === 0 ? (
              <div className="border border-dashed p-12 text-center">
                <MessageSquareQuote className="mx-auto mb-4 h-8 w-8 text-muted-foreground/30" />
                <p className="font-body text-sm text-muted-foreground">
                  No hay testimonios todavía para este tenant.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {testimonials.slice(0, 6).map((t) => (
                  <button
                    key={t.id}
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
        onUpdated={(updated) => {
          setSelectedTestimonial(updated);
          reload();
        }}
      />
    </>
  );
}
