'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { TestimonialRecord, TenantUser } from '@/lib/api';
import { MessageSquareQuote, Users, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TestimonialModal } from '@/components/testimonials/TestimonialModal';

export default function AdminOverviewPage() {
  const { session, fetchApi, isAdmin } = useSession();
  const [testimonials, setTestimonials] = useState<TestimonialRecord[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTestimonial, setSelectedTestimonial] = useState<TestimonialRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!session) return;

    async function load() {
      setLoading(true);
      try {
        const [tRes, uRes] = await Promise.all([
          fetchApi<TestimonialRecord[]>('/testimonials'),
          isAdmin ? fetchApi<TenantUser[]>('/users') : Promise.resolve({ data: [] as TenantUser[], success: true }),
        ]);
        setTestimonials(tRes.data);
        setUsers(uRes.data);
      } catch {
        // errors handled by useSession (401 redirect)
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [session, fetchApi, isAdmin]);

  const pending = testimonials.filter((t) => t.status === 'pending' || t.status === 'draft').length;
  const published = testimonials.filter((t) => t.status === 'published').length;

  const metrics = [
    {
      label: 'Total Testimonios',
      value: testimonials.length,
      icon: MessageSquareQuote,
      accent: false,
    },
    {
      label: 'Publicados',
      value: published,
      icon: TrendingUp,
      accent: false,
    },
    {
      label: 'Pendientes',
      value: pending,
      icon: Clock,
      accent: pending > 0,
    },
    ...(isAdmin
      ? [
          {
            label: 'Usuarios',
            value: users.length,
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

      {loading ? (
        <div className="flex items-center gap-3 py-20">
          <div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent" />
          <span className="font-body text-sm text-muted-foreground">Cargando métricas...</span>
        </div>
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
                  <m.icon className={cn('h-4 w-4', m.accent ? 'text-primary' : 'text-muted-foreground/50')} />
                </div>
                <p className="mt-3 font-caption text-4xl font-light italic text-foreground">{m.value}</p>
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
                    className="border bg-card p-6 transition-all hover:bg-muted/30 text-left hover:scale-[1.02] duration-300"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-body text-sm font-bold uppercase tracking-wider text-foreground">
                        {t.authorName}
                      </span>
                      <span
                        className={cn(
                          'px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider',
                          t.status === 'published' && 'bg-primary/20 text-primary',
                          t.status === 'pending' && 'bg-accent/20 text-accent',
                          t.status === 'draft' && 'bg-muted text-muted-foreground',
                          t.status === 'approved' && 'bg-primary/10 text-primary',
                          t.status === 'rejected' && 'bg-destructive/20 text-destructive',
                        )}
                      >
                        {t.status}
                      </span>
                    </div>
                    <p className="font-caption text-sm italic leading-relaxed text-muted-foreground line-clamp-3">
                      &ldquo;{t.content}&rdquo;
                    </p>
                    <div className="mt-4 flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <svg
                          key={i}
                          className={cn('h-3.5 w-3.5', i < t.rating ? 'text-primary' : 'text-muted-foreground/20')}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
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
          if (!open) setTimeout(() => setSelectedTestimonial(null), 300);
        }}
        onUpdated={() => {
          // Trigger a silent reload or just let it be since we don't have a specific load() bound here
          // We could reload by window.location.reload() but let's just leave it or fetch again
        }}
      />
    </>
  );
}
