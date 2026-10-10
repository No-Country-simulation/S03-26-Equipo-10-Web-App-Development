'use client';

import { useCallback } from 'react';
import type { SessionFetch } from '@/lib/api/validated-response';
import { getBiRequest, getBiRun } from '../operations-api';
import type { RequestDetail, RunDetail } from '../operations-schemas';
import type { BiCommand } from '../use-bi-command';
import { useBiResource } from '../use-bi-resource';
import { originNames, statusNames, timestamp } from '../format';
import { ActionButton, BiFailure, DetailLink, Loading } from '../components/shared';
import { RunContent, RunTable } from '../components/run-content';
import type { DetailHref } from './runs-view';

type Props = { fetchApi: SessionFetch; id: string; refreshKey: number; isAdmin: boolean; busy: boolean; blocked: boolean; execute: (command: BiCommand) => void; href: DetailHref; backHref: string };
const runInterval = (data: RunDetail | undefined) => !data || data.status === 'running' ? 5000 : null;
const requestInterval = (data: RequestDetail | undefined) => !data || ['pending', 'running'].includes(data.request.status) ? 5000 : null;
export function RunDetailView({ fetchApi, id, refreshKey, isAdmin, busy, blocked, execute, href, backHref }: Props) {
  const load = useCallback(async (signal: AbortSignal) => (await getBiRun(fetchApi, id, signal)).data, [fetchApi, id]);
  const resource = useBiResource(load, true, runInterval, refreshKey);
  const row = resource.data;
  return <section className="mt-6 space-y-5"><DetailLink href={backHref}>Volver a ejecuciones</DetailLink><h2 className="text-lg font-semibold">Detalle de ejecución</h2>
    {resource.loading && <Loading />}{Boolean(resource.error) && <BiFailure error={resource.error} onRetry={resource.reload} retained={Boolean(row)} />}
    {row && <><p className="break-all text-sm text-muted-foreground">Identificador: {row.id}</p><RunContent run={row} />
      {row.requestId && <DetailLink href={href('request', row.requestId)}>Ver solicitud asociada</DetailLink>}
      {isAdmin && <ActionButton action={row.actions.retry} busy={busy} disabled={blocked || Boolean(resource.error) || resource.refreshing} onClick={() => { if (row.actions.retry.runId) execute({ type: 'create', input: { kind: 'retry', retryOfRunId: row.actions.retry.runId } }); }}>Solicitar reintento actual</ActionButton>}
      <p className="text-sm text-muted-foreground">El reintento observa el estado actual y conserva el vínculo con este fallo. No reconstruye su hora original.</p></>}
  </section>;
}
export function RequestDetailView({ fetchApi, id, refreshKey, isAdmin, busy, blocked, execute, href, backHref }: Props) {
  const load = useCallback(async (signal: AbortSignal) => (await getBiRequest(fetchApi, id, signal)).data, [fetchApi, id]);
  const resource = useBiResource(load, true, requestInterval, refreshKey);
  const detail = resource.data; const row = detail?.request;
  return <section className="mt-6 space-y-5"><DetailLink href={backHref}>Volver a ejecuciones</DetailLink><h2 className="text-lg font-semibold">Detalle de solicitud</h2>
    {resource.loading && <Loading />}{Boolean(resource.error) && <BiFailure error={resource.error} onRetry={resource.reload} retained={Boolean(detail)} />}
    {row && detail && <><p className="break-all text-sm text-muted-foreground">Identificador: {row.id}</p><p role="status" className="border p-4 font-medium">Estado: {statusNames[row.status]}</p>
      <dl className="grid gap-4 sm:grid-cols-2">{[['Hora solicitada', timestamp(row.slotAt)], ['Origen', originNames[row.kind]], ['Aceptada', timestamp(row.createdAt)], ['Vence sin comenzar', timestamp(row.expiresAt)], ['Inicio', timestamp(row.startedAt)], ['Fin', timestamp(row.finishedAt)]].map(([label, value]) => <div className="min-w-0 border p-4" key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-2 break-words">{value}</dd></div>)}</dl>
      {row.errorMessage && <p role="alert" className="border p-4 text-sm">{row.errorMessage}{row.errorCode ? ` (${row.errorCode})` : ''}</p>}
      {row.retryOfRunId && <DetailLink href={href('run', row.retryOfRunId)}>Ver ejecución que motivó el reintento</DetailLink>}
      {isAdmin && <ActionButton action={detail.actions.cancel} busy={busy} disabled={blocked || Boolean(resource.error) || resource.refreshing} onClick={() => execute({ type: 'cancel', id: row.id })}>Cancelar solicitud pendiente</ActionButton>}
      <h3 className="font-semibold">Intentos asociados</h3><RunTable runs={detail.runs} href={runId => href('run', runId)} />
      {row.status === 'pending' && <p className="text-sm">La carga aún no comenzó. Podés cerrar la página y volver a consultar este enlace.</p>}
    </>}
  </section>;
}
