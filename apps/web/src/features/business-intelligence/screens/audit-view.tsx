'use client';

import { useCallback } from 'react';
import type { SessionFetch } from '@/lib/api/validated-response';
import { getBiAudit } from '../operations-api';
import type { BiSettings } from '../operations-schemas';
import { useBiResource } from '../use-bi-resource';
import type { BiQuery } from '../query';
import { timestamp } from '../format';
import { BiFailure, BiPagination, DetailLink, Loading, RangeForm } from '../components/shared';
import type { DetailHref, Navigate } from './runs-view';
const names = { settings_updated: 'Configuración modificada', request_created: 'Solicitud creada', request_cancelled: 'Solicitud cancelada' };
function Preferences({ value }: { value: BiSettings | null }) {
  return <p>{value ? `Versión ${value.version}; cada ${value.frequencyHours} h; ${value.scheduleEnabled ? 'activa' : 'pausada'}; avisos de fallos: ${value.alertFailures ? 'sí' : 'no'}; avisos de atrasos: ${value.alertDelays ? 'sí' : 'no'}; tolerancia ${value.delayToleranceMinutes} minutos.` : 'Sin configuración previa almacenada.'}</p>;
}
export default function AuditView({ fetchApi, query, refreshKey, navigate, href }: { fetchApi: SessionFetch; query: BiQuery; refreshKey: number; navigate: Navigate; href: DetailHref }) {
  const load = useCallback((signal: AbortSignal) => getBiAudit(fetchApi, { from: query.from, to: query.to, page: query.page, limit: 20 }, signal), [fetchApi, query.from, query.to, query.page]);
  const resource = useBiResource(load, true, null, refreshKey);
  return <section className="mt-6"><h2 className="text-lg font-semibold">Auditoría administrativa</h2>
    <RangeForm key={`${query.from}:${query.to}`} range={query} onApply={range => navigate({ ...range, page: '1' })} />
    {resource.loading && <Loading />}{Boolean(resource.error) && <BiFailure error={resource.error} onRetry={resource.reload} retained={Boolean(resource.data)} />}
    {resource.data && <>{resource.data.items.length ? <ul className="space-y-4">{resource.data.items.map(row => <li className="min-w-0 border p-5 text-sm" key={row.id}><h3 className="font-semibold">{names[row.action]}</h3><p className="mt-2">{timestamp(row.createdAt)}</p><p className="break-all text-muted-foreground">Actor técnico: {row.actorId}</p>
      {row.requestId && <DetailLink href={href('request', row.requestId)}>Ver solicitud</DetailLink>}
      {row.action === 'settings_updated' && <details className="mt-3"><summary className="cursor-pointer">Ver cambio de configuración</summary><h4 className="mt-3 font-semibold">Antes</h4><Preferences value={row.settingsBefore} /><h4 className="mt-3 font-semibold">Después</h4><Preferences value={row.settingsAfter} /></details>}
    </li>)}</ul> : <p className="border p-5 text-sm">No hay acciones administrativas en este rango.</p>}<BiPagination meta={resource.data.meta} label="auditoría" onChange={page => navigate({ page: String(page) })} /></>}
  </section>;
}
