'use client';

import { useCallback, useState } from 'react';
import type { SessionFetch } from '@/lib/api/validated-response';
import { getBiRequests, getBiRuns } from '../operations-api';
import type { BiQuery } from '../query';
import { useBiResource } from '../use-bi-resource';
import { originNames, statusNames, timestamp } from '../format';
import { BiFailure, BiPagination, DetailLink, Loading, RangeForm, selectClass } from '../components/shared';
import { RunTable } from '../components/run-content';

export type Navigate = (changes: Partial<Record<'view' | 'from' | 'to' | 'page' | 'requestPage' | 'status' | 'origin' | 'requestStatus' | 'run' | 'request', string | null>>) => void;
export type DetailHref = (type: 'run' | 'request', id: string) => string;
function Filters({ query, navigate }: { query: BiQuery; navigate: Navigate }) {
  const [status, setStatus] = useState(query.status ?? '');
  const [origin, setOrigin] = useState(query.origin ?? '');
  const [requestStatus, setRequestStatus] = useState(query.requestStatus ?? '');
  return <RangeForm range={query} onApply={range => navigate({ ...range, status: status || null, origin: origin || null, requestStatus: requestStatus || null, page: '1', requestPage: '1' })}>
    <label className="text-sm">Estado de ejecución<select className={selectClass} value={status} onChange={e => setStatus(e.target.value)}><option value="">Todos</option>{['running', 'succeeded', 'failed', 'abandoned'].map(value => <option key={value} value={value}>{statusNames[value]}</option>)}</select></label>
    <label className="text-sm">Origen de ejecución<select className={selectClass} value={origin} onChange={e => setOrigin(e.target.value)}><option value="">Todos</option>{Object.entries(originNames).map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>
    <label className="text-sm">Estado de solicitud<select className={selectClass} value={requestStatus} onChange={e => setRequestStatus(e.target.value)}><option value="">Todos</option>{['pending', 'running', 'succeeded', 'failed', 'cancelled', 'expired', 'skipped'].map(value => <option key={value} value={value}>{statusNames[value]}</option>)}</select></label>
  </RangeForm>;
}
export default function RunsView({ fetchApi, query, refreshKey, active, navigate, href }: {
  fetchApi: SessionFetch; query: BiQuery; refreshKey: number; active: boolean; navigate: Navigate; href: DetailHref;
}) {
  const loadRuns = useCallback((signal: AbortSignal) => getBiRuns(fetchApi, { from: query.from, to: query.to, page: query.page, limit: 20, status: query.status, origin: query.origin }, signal), [fetchApi, query.from, query.to, query.page, query.status, query.origin]);
  const loadRequests = useCallback((signal: AbortSignal) => getBiRequests(fetchApi, { from: query.from, to: query.to, page: query.requestPage, limit: 20, status: query.requestStatus }, signal), [fetchApi, query.from, query.to, query.requestPage, query.requestStatus]);
  const runs = useBiResource(loadRuns, true, active ? 5000 : null, refreshKey);
  const requests = useBiResource(loadRequests, true, active ? 5000 : null, refreshKey);
  return <section aria-labelledby="bi-runs-title"><h2 id="bi-runs-title" className="mt-6 text-lg font-semibold">Ejecuciones y solicitudes</h2>
    <Filters key={[query.from, query.to, query.status, query.origin, query.requestStatus].join(':')} query={query} navigate={navigate} />
    <h3 className="mt-6 font-semibold">Solicitudes de carga</h3><p className="my-2 text-sm text-muted-foreground">Pendiente significa que se guardó la solicitud. Su resultado se conserva aunque cierres esta página.</p>
    {requests.loading && <Loading>Cargando solicitudes…</Loading>}{Boolean(requests.error) && <BiFailure error={requests.error} onRetry={requests.reload} retained={Boolean(requests.data)} />}
    {requests.data && <>{requests.data.items.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Solicitudes de carga de tu empresa</caption><thead><tr>{['Creación UTC', 'Hora solicitada UTC', 'Origen', 'Estado', 'Vencimiento UTC', 'Detalle'].map(label => <th className="whitespace-nowrap border-b p-3" scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{requests.data.items.map(row => <tr key={row.id}><th scope="row" className="whitespace-nowrap border-b p-3 font-normal">{timestamp(row.createdAt)}</th><td className="whitespace-nowrap border-b p-3">{timestamp(row.slotAt)}</td><td className="border-b p-3">{originNames[row.kind]}</td><td className="border-b p-3">{statusNames[row.status]}</td><td className="whitespace-nowrap border-b p-3">{timestamp(row.expiresAt)}</td><td className="border-b p-3"><DetailLink href={href('request', row.id)}>Ver solicitud<span className="sr-only"> {row.id}</span></DetailLink></td></tr>)}</tbody></table></div> : <p className="border p-5 text-sm">No hay solicitudes en este rango con los filtros elegidos.</p>}<BiPagination meta={requests.data.meta} label="solicitudes" onChange={page => navigate({ requestPage: String(page) })} /></>}
    <h3 className="mb-3 mt-8 font-semibold">Intentos de ejecución</h3>
    {runs.loading && <Loading>Cargando ejecuciones…</Loading>}{Boolean(runs.error) && <BiFailure error={runs.error} onRetry={runs.reload} retained={Boolean(runs.data)} />}
    {runs.data && <><RunTable runs={runs.data.items} href={id => href('run', id)} /><BiPagination meta={runs.data.meta} label="ejecuciones" onChange={page => navigate({ page: String(page) })} /></>}
  </section>;
}
