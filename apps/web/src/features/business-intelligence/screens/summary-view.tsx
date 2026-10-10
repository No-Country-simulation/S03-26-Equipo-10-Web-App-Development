'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { SessionFetch } from '@/lib/api/validated-response';
import { getBiDashboard } from '../api';
import { useBiResource } from '../use-bi-resource';
import type { BiQuery } from '../query';
import { number, percentage, rating, statusNames, timestamp } from '../format';
import { downloadBiCsv, type CsvReport } from '../csv';
import { InventoryTrend } from '../components/inventory-trend';
import { BiFailure, Loading, RangeForm } from '../components/shared';

export default function SummaryView({ fetchApi, query, refreshKey, onRange }: {
  fetchApi: SessionFetch; query: BiQuery; refreshKey: number; onRange: (range: { from: string; to: string }) => void;
}) {
  const { from, to } = query;
  const load = useCallback(async (signal: AbortSignal) => (await getBiDashboard(fetchApi, { from, to }, signal)).data, [fetchApi, from, to]);
  const resource = useBiResource(load, true, null, refreshKey);
  const data = resource.data;
  const [exportError, setExportError] = useState('');
  function exportCsv(report: CsvReport) {
    if (!data || resource.error) return;
    try { downloadBiCsv(data, report); setExportError(''); } catch { setExportError('No se pudo descargar el archivo. Volvé a intentar.'); }
  }
  return <>
    <RangeForm key={`${from}:${to}`} range={{ from, to }} onApply={onRange} />
    {resource.loading && <Loading />}
    {Boolean(resource.error) && <BiFailure error={resource.error} onRetry={resource.reload} retained={Boolean(data)} />}
    {exportError && <p role="alert" className="mb-4 text-sm text-destructive">{exportError}</p>}
    {data && <>
      <div className="mb-6 flex flex-wrap items-center gap-2" aria-label="Descargas CSV del rango visible">
        <span className="mr-2 text-sm text-muted-foreground">Descargar CSV:</span>
        {([['summary', 'Resumen'], ['statuses', 'Estados'], ['categories', 'Categorías'], ['daily', 'Serie diaria']] as const).map(([report, label]) =>
          <Button type="button" size="sm" variant="outline" key={report} disabled={Boolean(resource.error) || resource.refreshing} onClick={() => exportCsv(report)}>{label} CSV</Button>)}
      </div>
      <div className="mb-6 border p-4 font-body text-sm">
        {data.freshness.schedulePaused && <p className="mb-2 font-semibold">Programación pausada. Las cargas manuales siguen disponibles; la alerta de atraso está suspendida.</p>}
        {data.freshness.status === 'not_loaded' ? <p>Esperando la primera carga. Todavía no hay un corte histórico disponible.</p> : <>
          {data.freshness.status === 'stale' && !data.freshness.schedulePaused && <p className="mb-2 font-semibold">Datos atrasados: el último corte supera la frecuencia de {data.freshness.frequencyHours} h y la tolerancia de {data.freshness.delayToleranceMinutes} min.</p>}
          <p>Corte del origen: {timestamp(data.freshness.sourceSnapshotAt)}. Actualización: {timestamp(data.freshness.lastPublishedAt)}.</p>
          <p className="mt-1 text-muted-foreground">Historial de cortes desde {timestamp(data.freshness.historyStartedAt)}. Interacciones desde {data.freshness.engagementHistoryStartedAt ?? 'Sin datos'}.</p>
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
