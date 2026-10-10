'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from '@/hooks/use-session';
import type { SessionFetch } from '@/lib/api/validated-response';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { getBiStatus } from '../operations-api';
import type { BiStatus } from '../operations-schemas';
import { biHref, biPath, parseBiQuery } from '../query';
import { useBiResource } from '../use-bi-resource';
import { useBiCommand } from '../use-bi-command';
import { timestamp } from '../format';
import { BiFailure, DetailLink, Loading, biFailure } from '../components/shared';
import SummaryView from './summary-view';
import RunsView, { type Navigate } from './runs-view';
import OperationView from './operation-view';
import SettingsView from './settings-view';
import AuditView from './audit-view';
import { RequestDetailView, RunDetailView } from './detail-view';
export { InventoryTrend } from '../components/inventory-trend';

const statusInterval = (status: BiStatus | undefined) => status?.activeRequest || status?.activeRun ? 5000 : 30000;
function BiWorkspace({ fetchApi, isAdmin, tenantName }: { fetchApi: SessionFetch; isAdmin: boolean; tenantName: string }) {
  const router = useRouter(); const search = useSearchParams(); const rawQuery = search.toString();
  const parsed = parseBiQuery(new URLSearchParams(rawQuery)); const query = parsed.query;
  const [refreshKey, setRefreshKey] = useState(0); const [notice, setNotice] = useState('');
  const refresh = () => setRefreshKey(value => value + 1);
  const navigate: Navigate = changes => router.push(biHref(new URLSearchParams(rawQuery), changes), { scroll: false });
  const href = (type: 'run' | 'request', id: string) => biHref(new URLSearchParams(rawQuery), { view: 'runs', run: type === 'run' ? id : null, request: type === 'request' ? id : null });
  const load = useCallback(async (signal: AbortSignal) => (await getBiStatus(fetchApi, signal)).data, [fetchApi]);
  const status = useBiResource(load, Boolean(query) && (query?.view !== 'audit' || isAdmin), statusInterval, refreshKey);
  const command = useBiCommand(fetchApi, result => {
    setNotice(result.type === 'create' ? 'Solicitud aceptada y guardada. Consultá su estado en el detalle.' : 'Cancelación confirmada por el servidor.');
    navigate({ view: 'runs', request: result.id, run: null });
  }, refresh);
  const blocked = command.uncertain || Boolean(status.error) || status.refreshing || !status.data;
  const views = [['summary', 'Resumen'], ['runs', 'Ejecuciones'], ['operation', 'Operación'], ['settings', 'Configuración'], ...(isAdmin ? [['audit', 'Auditoría']] : [])];
  const backHref = biHref(new URLSearchParams(rawQuery), { view: 'runs', run: null, request: null });
  return <div className="min-w-0 font-body">
    <DashboardHeader title="Inteligencia de negocio" description={`${tenantName} · Indicadores, cargas y configuración. Fechas y cortes en UTC.`}>
      <Button variant="outline" onClick={refresh}>Actualizar vista</Button>
    </DashboardHeader>
    <nav aria-label="Vistas de inteligencia de negocio" className="flex flex-wrap gap-2 border-b pb-4">{views.map(([view, label]) => <Link key={view} prefetch={false} scroll={false} href={biHref(new URLSearchParams(rawQuery), { view, run: null, request: null, page: '1', requestPage: '1' })} aria-current={query?.view === view ? 'page' : undefined}
      className={`px-4 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${query?.view === view ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}>{label}</Link>)}</nav>
    {parsed.error && <div role="alert" className="mt-6 border p-5"><p>{parsed.error}</p><DetailLink href={biPath}>Restablecer vista</DetailLink></div>}
    {query?.view === 'audit' && !isAdmin ? <p role="alert" className="mt-6 border p-5">La auditoría administrativa está reservada a administradores.</p> : query && <>
      {Boolean(status.error) && <BiFailure error={status.error} onRetry={status.reload} retained={Boolean(status.data)} />}
      {status.data && <section aria-label="Alertas y vigencia operativa" className="mt-5 space-y-3 border p-4 text-sm"><p>Estado consultado: {timestamp(status.data.observedAt)}. {status.data.schedule.paused ? 'Programación pausada; aviso de atraso suspendido.' : `Programación cada ${status.data.schedule.frequencyHours} h.`}</p>
        {status.data.activeRequest && <p>Solicitud activa: <DetailLink href={href('request', status.data.activeRequest.id)}>Consultar seguimiento</DetailLink></p>}
        {status.data.alerts.length ? <ul className="space-y-3">{status.data.alerts.map((alert, index) => <li key={`${alert.code}:${index}`} className={alert.severity === 'error' ? 'font-medium' : ''}><span>{alert.severity === 'error' ? 'Error' : 'Aviso'}: {alert.message}</span>{alert.runId && <> · <DetailLink href={href('run', alert.runId)}>Ver ejecución</DetailLink></>}{alert.requestId && <> · <DetailLink href={href('request', alert.requestId)}>Ver solicitud</DetailLink></>}</li>)}</ul> : <p>Sin alertas activas.</p>}
      </section>}
      {notice && <p role="status" className="mt-5 border p-4 text-sm">{notice}</p>}
      {Boolean(command.error) && <div role="alert" className="mt-5 space-y-3 border border-destructive/50 p-4 text-sm"><p>{biFailure(command.error)}</p>{command.uncertain && <><p>La solicitud puede haberse guardado. Revisá el seguimiento o repetí la misma solicitud con su clave original para recuperar el resultado sin duplicarla.</p><Button type="button" variant="outline" disabled={command.busy} onClick={command.repeat}>Repetir solicitud con la misma clave</Button></>}</div>}
      {query.view === 'summary' && <SummaryView fetchApi={fetchApi} query={query} refreshKey={refreshKey} onRange={range => navigate({ ...range, page: '1', requestPage: '1' })} />}
      {query.view === 'runs' && (query.run || query.request ? (() => { const props = { fetchApi, id: query.run ?? query.request!, refreshKey, isAdmin, busy: command.busy, blocked, execute: command.execute, href, backHref }; return query.run ? <RunDetailView key={`run:${query.run}`} {...props} /> : <RequestDetailView key={`request:${query.request}`} {...props} />; })() : <RunsView fetchApi={fetchApi} query={query} refreshKey={refreshKey} active={Boolean(status.data?.activeRequest || status.data?.activeRun)} navigate={navigate} href={href} />)}
      {query.view === 'operation' && (status.data ? <OperationView status={status.data} isAdmin={isAdmin} busy={command.busy} blocked={blocked} execute={command.execute} href={href} /> : !status.error && <Loading>Cargando operación…</Loading>)}
      {query.view === 'settings' && <SettingsView fetchApi={fetchApi} refreshKey={refreshKey} isAdmin={isAdmin} action={status.data?.actions.updateSettings} blocked={blocked || command.busy} onSaved={refresh} />}
      {query.view === 'audit' && isAdmin && <AuditView fetchApi={fetchApi} query={query} refreshKey={refreshKey} navigate={navigate} href={href} />}
    </>}
  </div>;
}
export default function BiScreen() {
  const { session, fetchApi, loading } = useSession();
  if (loading) return <Loading>Cargando sesión…</Loading>;
  if (!session) return <p role="alert">Iniciá sesión para consultar inteligencia de negocio.</p>;
  const roles = session.user.roles;
  if (!roles.some(role => role === 'admin' || role === 'editor')) return <p role="alert">Tu usuario no tiene acceso a inteligencia de negocio.</p>;
  return <BiWorkspace key={`${session.user.id}:${session.user.tenantId}:${[...roles].sort().join(',')}`} fetchApi={fetchApi} isAdmin={roles.includes('admin')} tenantName={session.user.tenantName} />;
}
