'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { rangeError } from '../query';
import type { BiAction } from '../operations-schemas';

export const selectClass = 'mt-2 h-10 w-full border border-input bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60';
export const linkClass = 'break-words text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';
export function biFailure(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'BI_DISABLED') return 'La inteligencia de negocio todavía no está habilitada para este entorno.';
    if (error.code === 'BI_OPERATIONS_DISABLED') return 'Los controles de inteligencia de negocio todavía no están habilitados para este entorno. El resumen puede seguir disponible.';
    if (error.code === 'BI_WORKER_UNAVAILABLE') return 'El servicio de cargas no está disponible. Consultá su estado antes de solicitar otra carga.';
    if (error.code === 'BI_UNAVAILABLE') return 'La inteligencia de negocio está temporalmente indisponible. La captura y moderación siguen disponibles.';
    if (error.status === 401) return 'Tu sesión venció. Volvé a iniciar sesión.';
    if (error.status === 403) return 'Tu usuario no tiene permiso para consultar esta vista o realizar esta acción.';
    if (error.status === 404) return 'El recurso no existe o no está disponible en tu empresa.';
    if (error.status === 429) return 'Alcanzaste el límite de consultas. Esperá antes de volver a intentar.';
    if (error.code === 'INVALID_RESPONSE') return 'No pudimos validar la respuesta del servidor. Actualizá la vista antes de continuar.';
    if (error.code === 'BI_SETTINGS_CONFLICT') return 'Otro administrador cambió la configuración. Tus cambios se conservaron; cargá la versión vigente antes de guardar.';
    if (error.status === 409) return 'El estado cambió o la acción está bloqueada. Actualizá la vista y revisá el motivo antes de volver a intentar.';
    if (error.status === 400 || error.status === 422) return 'Revisá los datos y el rango de fechas antes de continuar.';
  }
  return 'No pudimos confirmar la respuesta. Revisá la conexión y actualizá la vista.';
}
export function BiFailure({ error, onRetry, retained = false }: { error: unknown; onRetry: () => void; retained?: boolean }) {
  const permanent = error instanceof ApiError && [401, 403, 404].includes(error.status ?? 0);
  return <div role="alert" className="my-4 border border-destructive/50 bg-card p-4 text-sm">
    <p>{biFailure(error)}</p>{retained && <p className="mt-2">Se muestra la última respuesta recibida. Las acciones están bloqueadas hasta actualizar.</p>}
    {!permanent && <Button type="button" variant="outline" className="mt-3" onClick={onRetry}>Reintentar lectura</Button>}
  </div>;
}
export function Loading({ children = 'Cargando inteligencia de negocio…' }: { children?: ReactNode }) {
  return <p role="status" className="border p-6 text-sm">{children}</p>;
}
export function RangeForm({ range, onApply, children }: { range: { from: string; to: string }; onApply: (range: { from: string; to: string }) => void; children?: ReactNode }) {
  const [draft, setDraft] = useState(range); const [error, setError] = useState<string | null>(null); const id = useId();
  function apply(event: FormEvent) {
    event.preventDefault(); const failure = rangeError(draft); setError(failure); if (!failure) onApply(draft);
  }
  const today = new Date().toISOString().slice(0, 10);
  return <form onSubmit={apply} className="my-6 flex flex-wrap items-end gap-4" aria-label="Rango de fechas BI">
    <label className="min-w-0 text-sm">Desde (UTC)<Input type="date" className="mt-2" required max={today} value={draft.from}
      onChange={event => setDraft({ ...draft, from: event.target.value })} aria-invalid={Boolean(error)} aria-describedby={error ? id : undefined} /></label>
    <label className="min-w-0 text-sm">Hasta (UTC)<Input type="date" className="mt-2" required max={today} value={draft.to}
      onChange={event => setDraft({ ...draft, to: event.target.value })} aria-invalid={Boolean(error)} aria-describedby={error ? id : undefined} /></label>
    {children}<Button type="submit">Aplicar filtros</Button>
    {error && <p id={id} role="alert" className="w-full text-sm text-destructive">{error}</p>}
  </form>;
}
export function ActionButton({ action, busy, disabled, children, onClick }: {
  action: BiAction; busy?: boolean; disabled?: boolean; children: ReactNode; onClick: () => void;
}) {
  const id = useId();
  return <div className="min-w-0"><Button type="button" onClick={onClick} disabled={busy || disabled || !action.allowed}
    aria-describedby={!action.allowed ? id : undefined}>{busy ? 'Enviando solicitud…' : children}</Button>
    {!action.allowed && <p id={id} className="mt-2 max-w-lg text-sm text-muted-foreground">{action.message ?? 'Acción no disponible.'}</p>}
  </div>;
}
export function BiPagination({ meta, onChange, label }: { meta: { page: number; total: number; limit: number }; onChange: (page: number) => void; label: string }) {
  const pages = Math.min(10000, Math.max(1, Math.ceil(meta.total / meta.limit)));
  return <nav aria-label={`Paginación de ${label}`} className="mt-4 flex flex-wrap items-center justify-end gap-3 text-sm">
    <span>Página {meta.page} de {pages} · {meta.total.toLocaleString('es-AR')} registros</span>
    <Button type="button" variant="outline" disabled={meta.page <= 1} onClick={() => onChange(meta.page - 1)}>Anterior</Button>
    <Button type="button" variant="outline" disabled={meta.page >= pages} onClick={() => onChange(meta.page + 1)}>Siguiente</Button>
    {Math.ceil(meta.total / meta.limit) > 10000 && <p className="w-full">Refiná el rango para consultar más de 10.000 páginas.</p>}
  </nav>;
}
export function DetailLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} prefetch={false} className={linkClass}>{children}</Link>;
}
