'use client';

import { useCallback, useState } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import { useRemoteResource } from '@/features/shared/use-remote-resource';
import { getBiDashboard, type BiDashboard } from '../api';

function initialRange() {
  const to = new Date().toISOString().slice(0, 10);
  return { from: new Date(Date.parse(to) - 29 * 86400000).toISOString().slice(0, 10), to };
}
const number = (value: string | number) => typeof value === 'string' ? BigInt(value).toLocaleString('es-AR') : value.toLocaleString('es-AR');
const rating = (value: number | null) => value === null ? 'Sin datos' : value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
const percentage = (value: number | null) => value === null ? 'Sin datos' : `${rating(value)} %`;
const timestamp = (value: string | null) => value ? new Date(value).toLocaleString('es-AR', { timeZone: 'UTC' }) : 'Sin datos';
const statusNames: Record<string, string> = { draft: 'Borrador', pending: 'Pendiente', approved: 'Aprobado', published: 'Publicado', rejected: 'Rechazado' };

export function InventoryTrend({ rows }: { rows: BiDashboard['testimonialSeries'] }) {
  const max = Math.max(1, ...rows.map(row => row.total ?? 0));
  const step = 560 / Math.max(1, rows.length - 1);
  // Separate paths at missing cuts: absence is never drawn as zero or interpolated.
  let path = '';
  let continuous = false;
  rows.forEach((row, index) => {
    if (row.total === null) { continuous = false; return; }
    path += `${continuous ? ' L' : ' M'}${20 + index * step},${130 - row.total / max * 110}`;
    continuous = true;
  });
  return <svg viewBox="0 0 600 155" className="mt-4 w-full max-w-3xl text-primary" role="img" aria-label="Evolución del inventario de testimonios; detalle por día en la tabla">
    <path d="M20,20 V130 H580" stroke="currentColor" opacity="0.3" fill="none" />
    <path d={path} stroke="currentColor" strokeWidth="2" fill="none" />
    {rows.map((row, index) => row.total === null ? null : <circle key={row.date} cx={20 + index * step} cy={130 - row.total / max * 110} r="3" fill="currentColor"><title>{row.date}: {row.total}</title></circle>)}
    <text x="20" y="150" fill="currentColor" fontSize="10">{rows[0]?.date}</text><text x="580" y="150" textAnchor="end" fill="currentColor" fontSize="10">{rows.at(-1)?.date}</text>
  </svg>;
}

export default function BiScreen() {
  const { session, fetchApi } = useSession();
  const [range, setRange] = useState(initialRange);
  const [draft, setDraft] = useState(range);
  const [validation, setValidation] = useState('');
  const identity = session?.user.id;
  const tenant = session?.user.tenantId;
  const load = useCallback(async () => {
    // The identity dependencies invalidate previous account data without sending tenant IDs to the API.
    if (!identity || !tenant) throw new Error('Session unavailable');
    return (await getBiDashboard(fetchApi, range)).data;
  }, [fetchApi, range, identity, tenant]);
  const { state, reload } = useRemoteResource(load, Boolean(session));
  const data = state.status === 'success' ? state.data : null;
  const today = new Date().toISOString().slice(0, 10);
  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const days = (Date.parse(draft.to) - Date.parse(draft.from)) / 86400000 + 1;
    if (!Number.isFinite(days) || days < 1 || days > 366 || draft.to > today) { setValidation('Seleccioná entre 1 y 366 días, hasta hoy, en UTC.'); return; }
    setValidation(''); setRange({ ...draft });
  };
  let failure = 'No pudimos cargar la inteligencia de negocio. Podés reintentar.';
  if (state.status === 'error' && state.error instanceof ApiError) {
    if (state.error.code === 'BI_DISABLED') failure = 'La inteligencia de negocio todavía no está habilitada para este entorno.';
    else if (state.error.code === 'BI_UNAVAILABLE') failure = 'La inteligencia de negocio está temporalmente indisponible. La captura y moderación siguen disponibles.';
    else if (state.error.status === 403) failure = 'Tu usuario no tiene permiso para consultar este panel.';
  }
  return <>
    <DashboardHeader title="Inteligencia de negocio" description="Inventario histórico e interacciones de tu empresa. Cortes horarios y fechas en UTC.">
      <Button variant="outline" disabled={state.status === 'loading'} onClick={reload}>Actualizar</Button>
    </DashboardHeader>
    <form onSubmit={apply} className="mb-8 flex flex-wrap items-end gap-4" aria-label="Rango de fechas BI">
      <label className="font-body text-sm">Desde (UTC)<Input className="mt-2" type="date" required max={today} value={draft.from} onChange={e => setDraft({ ...draft, from: e.target.value })} aria-describedby={validation ? 'bi-range-error' : undefined} /></label>
      <label className="font-body text-sm">Hasta (UTC)<Input className="mt-2" type="date" required max={today} value={draft.to} onChange={e => setDraft({ ...draft, to: e.target.value })} aria-describedby={validation ? 'bi-range-error' : undefined} /></label>
      <Button type="submit" disabled={state.status === 'loading'}>Aplicar rango</Button>
      {validation && <p id="bi-range-error" role="alert" className="w-full text-sm text-destructive">{validation}</p>}
    </form>
    {state.status === 'loading' && <p role="status" className="border p-8 font-body text-sm">Cargando inteligencia de negocio…</p>}
    {state.status === 'error' && <div role="alert" className="border p-8 font-body text-sm"><p>{failure}</p><Button className="mt-4" onClick={reload}>Reintentar</Button></div>}
    {data && <>
      <div role="status" className="mb-6 border p-4 font-body text-sm">
        {data.freshness.status === 'not_loaded' ? <p>Esperando la primera carga. Todavía no hay un corte histórico disponible.</p> : <>
          {data.freshness.status === 'stale' && <p className="mb-2 font-semibold">Datos atrasados: el último corte tiene más de dos horas.</p>}
          <p>Corte del origen: {timestamp(data.freshness.sourceSnapshotAt)} UTC. Actualización: {timestamp(data.freshness.lastPublishedAt)} UTC.</p>
          <p className="mt-1 text-muted-foreground">Historial de cortes desde {timestamp(data.freshness.historyStartedAt)} UTC. Interacciones desde {data.freshness.engagementHistoryStartedAt ?? 'Sin datos'}.</p>
        </>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[['Testimonios del último corte', number(data.summary.totalTestimonials)], ['Rating promedio', rating(data.summary.averageRating)],
          ['Vistas en el rango', number(data.summary.views)], ['CTR en el rango', percentage(data.summary.ctr)],
          ['Clics en el rango', number(data.summary.clicks)], ['Reproducciones en el rango', number(data.summary.plays)]].map(([label, value]) =>
          <div className="min-w-0 border p-6" key={label}><h2 className="font-body text-xs uppercase tracking-wider text-muted-foreground">{label}</h2><p className="mt-4 break-words font-caption text-3xl italic">{value}</p></div>)}
      </div>
      <p className="mt-4 font-body text-sm text-muted-foreground">CTR = clics / vistas × 100. Son eventos, no visitantes únicos; el porcentaje puede superar 100 %.</p>
      <div className="my-8 grid gap-8 md:grid-cols-2">
        <section><h2 className="font-body font-semibold">Estados del último corte</h2>{data.summary.statuses.length ? <ul className="mt-4 space-y-2 font-body text-sm">{data.summary.statuses.map(row => <li key={row.code} className="flex justify-between border-b py-2"><span>{statusNames[row.code] ?? row.code}</span><span>{number(row.count)}</span></li>)}</ul> : <p className="mt-4 text-sm">No hay testimonios en el último corte.</p>}</section>
        <section><h2 className="font-body font-semibold">Categorías del último corte</h2>{data.categories.length ? <ul className="mt-4 space-y-2 font-body text-sm">{data.categories.map(row => <li key={row.categoryKey} className="flex justify-between gap-4 border-b py-2"><span className="break-words">{row.name}</span><span className="shrink-0">{number(row.count)} · rating {rating(row.averageRating)}</span></li>)}</ul> : <p className="mt-4 text-sm">No hay categorías con testimonios en el último corte.</p>}</section>
      </div>
      <section className="mt-8"><h2 className="font-body font-semibold">Evolución diaria de testimonios</h2><p className="mt-2 font-body text-sm text-muted-foreground">Último corte disponible de cada día. Las horas sin carga quedan ausentes; el inventario no se suma entre cortes.</p>
        <InventoryTrend rows={data.testimonialSeries} />
        <details className="mt-4 border p-4"><summary className="cursor-pointer font-body text-sm">Ver detalle diario e interacciones</summary><div className="mt-4 overflow-x-auto"><table className="w-full text-left font-body text-sm"><caption className="sr-only">Evolución diaria e interacciones del rango en UTC</caption>
          <thead><tr>{['Fecha UTC', 'Testimonios', 'Rating', 'Corte UTC', 'Vistas', 'Clics', 'Reproducciones', 'CTR'].map(label => <th scope="col" key={label} className="whitespace-nowrap border-b p-3">{label}</th>)}</tr></thead>
          <tbody>{data.testimonialSeries.map((row, index) => { const events = data.engagementSeries[index]; return <tr key={row.date}>
            <th scope="row" className="whitespace-nowrap border-b p-3 font-normal">{row.date}</th><td className="border-b p-3">{row.total === null ? 'Sin corte' : number(row.total)}</td><td className="border-b p-3">{rating(row.averageRating)}</td><td className="whitespace-nowrap border-b p-3">{timestamp(row.snapshotAt)}</td>
            <td className="border-b p-3">{events ? number(events.views) : 'Sin datos'}</td><td className="border-b p-3">{events ? number(events.clicks) : 'Sin datos'}</td><td className="border-b p-3">{events ? number(events.plays) : 'Sin datos'}</td><td className="border-b p-3">{percentage(events?.ctr ?? null)}</td>
          </tr>; })}</tbody></table></div></details>
      </section>
    </>}
  </>;
}
