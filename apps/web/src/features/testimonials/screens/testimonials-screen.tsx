'use client';

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { TestimonialRecord } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Plus, RefreshCw } from 'lucide-react';
import { TestimonialModal } from '../components/TestimonialModal';
import { CreateTestimonialModal } from '../components/CreateTestimonialModal';
import { CatalogFilter } from '../components/CatalogFilter';
import { testimonialStatusLabels } from '../presentation';
import { getTestimonial, listTestimonials } from '../api';
import {
  readTestimonialLocation,
  testimonialLocation,
  testimonialStates,
  type TestimonialFilters,
} from '../query';
import { PageControls } from '@/features/shared/pagination';
import { LoadFailure, actionFailureCopy } from '@/features/shared/load-failure';
import { ActionFeedback, LoadingState } from '@/features/shared/feedback';
import { useRemoteResource } from '@/features/shared/use-remote-resource';

function TestimonialsContent() {
  const { session, fetchApi } = useSession();
  const router = useRouter();
  const raw = useSearchParams().toString();
  const location = useMemo(() => readTestimonialLocation(raw), [raw]);
  const valid = location.valid;
  const page = location.valid ? location.page : 1;
  const filterKey = JSON.stringify(location.valid ? location.filters : {});
  const filters = useMemo(
    () => JSON.parse(filterKey) as TestimonialFilters,
    [filterKey],
  );
  const detailId = location.valid ? location.testimonial : undefined;
  const [search, setSearch] = useState(filters.q ?? '');
  useEffect(() => setSearch(filters.q ?? ''), [filters.q]);
  const [createOpen, setCreateOpen] = useState(false);
  const [localDetail, setLocalDetail] = useState<{
    record: TestimonialRecord;
    tenantId: string | undefined;
  } | null>(null);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const navigationLock = useRef(false);
  const queryIdentity = JSON.stringify({
    page,
    filters,
    detailId,
    tenantId: session?.user.tenantId,
  });
  const activeQuery = useRef(queryIdentity);
  activeQuery.current = queryIdentity;
  const navigate = useCallback(
    (
      nextPage: number,
      nextFilters: TestimonialFilters,
      testimonial?: string,
      replace = false,
    ) => {
      const href = testimonialLocation(nextPage, nextFilters, testimonial);
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [router],
  );
  function changeFilters(patch: Partial<TestimonialFilters>) {
    navigate(1, { ...filters, ...patch });
  }
  const load = useCallback(
    async () => (await listTestimonials(fetchApi, page, filters)).data,
    [fetchApi, page, filters],
  );
  const { state, reload } = useRemoteResource(load, Boolean(session) && valid);
  const loadDetail = useCallback(
    async () => (await getTestimonial(fetchApi, detailId!)).data,
    [fetchApi, detailId],
  );
  const detail = useRemoteResource(
    loadDetail,
    Boolean(session) && Boolean(detailId),
  );
  const selectedTestimonial =
    localDetail &&
    localDetail.record.id === detailId &&
    localDetail?.tenantId === session?.user.tenantId
      ? localDetail.record
      : detail.state.status === 'success'
        ? detail.state.data
        : null;
  const testimonials = state.status === 'success' ? state.data.items : [];
  const total = state.status === 'success' ? state.data.meta.total : 0;
  const index = testimonials.findIndex((record) => record.id === detailId);
  useEffect(() => {
    if (state.status !== 'success') return;
    const lastPage = Math.max(1, Math.ceil(state.data.meta.total / 20));
    if (page > lastPage) navigate(lastPage, filters, detailId, true);
  }, [state, page, filters, detailId, navigate]);
  function openDetail(record: TestimonialRecord) {
    setLocalDetail(null);
    setNavigationError(null);
    navigate(page, filters, record.id);
  }
  async function adjacent(direction: -1 | 1) {
    if (navigationLock.current || index < 0) return;
    const originalQuery = queryIdentity;
    navigationLock.current = true;
    setNavigating(true);
    setNavigationError(null);
    try {
      const nextIndex = index + direction;
      if (nextIndex >= 0 && nextIndex < testimonials.length)
        openDetail(testimonials[nextIndex]);
      else {
        const nextPage = page + direction;
        const response = await listTestimonials(fetchApi, nextPage, filters);
        if (activeQuery.current !== originalQuery) return;
        const record =
          direction === 1 ? response.data.items[0] : response.data.items.at(-1);
        if (record) {
          setLocalDetail(null);
          navigate(nextPage, filters, record.id);
        } else {
          setNavigationError(
            'La consulta cambió. Actualizá la lista antes de continuar.',
          );
          reload();
        }
      }
    } catch (error) {
      if (activeQuery.current === originalQuery)
        setNavigationError(actionFailureCopy(error, 'la navegación'));
    } finally {
      navigationLock.current = false;
      setNavigating(false);
    }
  }
  return (
    <>
      <DashboardHeader
        title="Testimonios"
        description="Buscá en todo el espacio y revisá cada testimonio en su contexto."
      >
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
          Nuevo
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            reload();
            detail.reload();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Refrescar
        </Button>
      </DashboardHeader>
      {!valid ? (
        <ActionFeedback>
          El enlace contiene filtros o un identificador inválido.{' '}
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(1, {}, undefined, true)}
          >
            Limpiar consulta
          </Button>
        </ActionFeedback>
      ) : (
        <>
          <div className="mb-8 space-y-4">
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                changeFilters({ q: search.trim() });
              }}
            >
              <div className="min-w-0 flex-1">
                <label
                  htmlFor="testimonial-search"
                  className="mb-2 block font-body text-sm"
                >
                  Buscar por autor o contenido
                </label>
                <Input
                  id="testimonial-search"
                  maxLength={200}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por autor o contenido..."
                />
              </div>
              <Button type="submit">Buscar</Button>
            </form>
            <div className="grid gap-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
              <label className="grid min-w-0 flex-1 gap-2 font-body text-sm">
                Estado
                <select
                  className="min-h-11 min-w-0 border bg-background px-3 text-base md:text-sm"
                  value={filters.status ?? ''}
                  onChange={(event) =>
                    changeFilters({
                      status: (event.target.value ||
                        undefined) as TestimonialFilters['status'],
                    })
                  }
                >
                  <option value="">Todos los estados</option>
                  {testimonialStates.map((status) => (
                    <option key={status} value={status}>
                      {testimonialStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-0 flex-1 gap-2 font-body text-sm">
                Orden
                <select
                  className="min-h-11 min-w-0 border bg-background px-3 text-base md:text-sm"
                  value={filters.sort ?? 'createdAt:desc'}
                  onChange={(event) =>
                    changeFilters({
                      sort: event.target.value as TestimonialFilters['sort'],
                    })
                  }
                >
                  <option value="createdAt:desc">Más recientes</option>
                  <option value="score:desc">Mayor relevancia (puntaje)</option>
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSearch('');
                  navigate(1, {});
                }}
              >
                Limpiar consulta
              </Button>
            </div>
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <CatalogFilter
                kind="categories"
                fetchApi={fetchApi}
                enabled={Boolean(session)}
                selected={filters.categoryId ? [filters.categoryId] : []}
                onChange={(ids) => changeFilters({ categoryId: ids[0] })}
              />
              <CatalogFilter
                kind="tags"
                fetchApi={fetchApi}
                enabled={Boolean(session)}
                selected={filters.tagIds ?? []}
                onChange={(ids) => changeFilters({ tagIds: ids })}
              />
            </div>
            {filters.q && (
              <p className="font-body text-sm text-muted-foreground">
                Resultados para «{filters.q}» en todo el espacio.
              </p>
            )}
          </div>
          {state.status === 'loading' ? (
            <LoadingState>Cargando testimonios…</LoadingState>
          ) : state.status === 'error' ? (
            <LoadFailure
              error={state.error}
              resource="los testimonios"
              onRetry={reload}
            />
          ) : testimonials.length === 0 ? (
            <div className="border border-dashed p-8 font-body">
              <p>No hay testimonios que coincidan con esta consulta.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Probá otros filtros o limpiá la consulta.
              </p>
            </div>
          ) : (
            <div
              role="region"
              aria-label="Tabla de testimonios"
              tabIndex={0}
              className="min-w-0 overflow-x-auto bg-card shadow-soft-lg"
            >
              <table className="w-full">
                <caption className="sr-only">
                  Testimonios de este espacio
                </caption>
                <thead>
                  <tr className="border-b">
                    <th
                      scope="col"
                      className="py-4 pl-4 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      ID
                    </th>
                    <th
                      scope="col"
                      className="py-4 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Autor
                    </th>
                    <th
                      scope="col"
                      className="py-4 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Extracto
                    </th>
                    <th
                      scope="col"
                      className="py-4 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Estado
                    </th>
                    <th
                      scope="col"
                      className="py-4 text-right pr-4 font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                    >
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {testimonials.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border/50 transition-colors hover:bg-muted/10 group"
                    >
                      <td className="py-4 pl-4 font-body text-xs text-muted-foreground">
                        {t.id.split('-')[0]}
                      </td>
                      <td className="py-4 pr-4 font-body text-sm font-medium text-foreground">
                        {t.authorName}
                      </td>
                      <td className="max-w-[200px] sm:max-w-xs py-4 pr-4">
                        <div className="truncate font-caption text-sm italic text-muted-foreground mb-1">
                          &ldquo;{t.content}&rdquo;
                        </div>
                        <div className="flex gap-1 overflow-hidden">
                          {t.category && (
                            <span className="text-[8px] bg-primary/10 text-primary px-1 font-body uppercase">
                              {t.category.name}
                            </span>
                          )}
                          {t.tags?.slice(0, 2).map((tag) => (
                            <span
                              key={tag.id}
                              className="text-[8px] border px-1 font-body text-muted-foreground uppercase"
                            >
                              #{tag.name}
                            </span>
                          ))}
                          {(t.tags?.length || 0) > 2 && (
                            <span className="text-[8px] text-muted-foreground">
                              ...
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <span
                          className={cn(
                            'inline-block px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider',
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
                      </td>
                      <td className="py-4 pr-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            openDetail(t);
                          }}
                          className="font-body text-[10px] uppercase tracking-wider hover:bg-primary hover:text-primary-foreground rounded-none"
                        >
                          Abrir Testimonio
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {state.status === 'success' && (
            <PageControls
              page={page}
              total={total}
              limit={20}
              onChange={(next) => navigate(next, filters)}
            />
          )}
          {detailId &&
            !selectedTestimonial &&
            (detail.state.status === 'loading' ? (
              <LoadingState>Cargando el testimonio del enlace…</LoadingState>
            ) : (
              detail.state.status === 'error' && (
                <LoadFailure
                  error={detail.state.error}
                  resource="el testimonio del enlace"
                  onRetry={detail.reload}
                />
              )
            ))}
        </>
      )}
      <CreateTestimonialModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={reload}
      />
      <TestimonialModal
        testimonial={selectedTestimonial}
        open={Boolean(detailId && selectedTestimonial)}
        onOpenChange={(open) => {
          if (!open) {
            navigate(page, filters);
            setLocalDetail(null);
          }
        }}
        onUpdated={(updated) => {
          setLocalDetail({ record: updated, tenantId: session?.user.tenantId });
          reload();
        }}
        onDeleted={() => {
          navigate(page, filters);
          setLocalDetail(null);
          reload();
        }}
        navigation={{
          previous: () => void adjacent(-1),
          next: () => void adjacent(1),
          busy: navigating,
          canPrevious: index >= 0 && (index > 0 || page > 1),
          canNext:
            index >= 0 &&
            (index < testimonials.length - 1 || page * 20 < total),
          description:
            index >= 0
              ? `Resultado ${(page - 1) * 20 + index + 1} de ${total} en esta consulta.`
              : 'Este testimonio está fuera de los resultados actuales.',
          error: navigationError,
        }}
      />
    </>
  );
}
export function TestimonialsScreen() {
  return (
    <Suspense fallback={<LoadingState>Cargando la consulta…</LoadingState>}>
      <TestimonialsContent />
    </Suspense>
  );
}
