'use client';

import { useCallback } from 'react';
import type { SessionFetch } from '@/lib/api/validated-response';
import { getBiAudit } from '../operations-api';
import type { BiSettings } from '../operations-schemas';
import { useBiResource } from '../use-bi-resource';
import type { BiQuery } from '../query';
import { timestamp } from '../format';
import {
  BiFailure,
  BiPagination,
  DetailLink,
  Loading,
  RangeForm,
} from '../components/shared';
import type { DetailHref, Navigate } from './runs-view';
const names = {
  settings_updated: 'Configuración modificada',
  request_created: 'Solicitud creada',
  request_cancelled: 'Solicitud cancelada',
};
const fields = [
  [
    'frequencyHours',
    'Frecuencia',
    (value: number | boolean) => `cada ${value} h`,
  ],
  [
    'scheduleEnabled',
    'Programación',
    (value: number | boolean) => (value ? 'Activa' : 'Pausada'),
  ],
  [
    'alertFailures',
    'Avisos de fallos',
    (value: number | boolean) => (value ? 'Sí' : 'No'),
  ],
  [
    'alertDelays',
    'Avisos de atrasos',
    (value: number | boolean) => (value ? 'Sí' : 'No'),
  ],
  [
    'delayToleranceMinutes',
    'Tolerancia de atraso',
    (value: number | boolean) => `${value} minutos`,
  ],
] as const;
function Changes({
  before,
  after,
}: {
  before: BiSettings | null;
  after: BiSettings | null;
}) {
  if (!after)
    return <p className="mt-3">No se almacenó la configuración posterior.</p>;
  const changed = fields.filter(
    ([key]) => !before || before[key] !== after[key],
  );
  return (
    <div className="mt-3">
      <p className="mb-2">
        {before
          ? `Versión ${before.version} → ${after.version}`
          : 'Primera configuración registrada; no hay valores anteriores almacenados.'}
      </p>
      {changed.length ? (
        <ul className="space-y-2">
          {changed.map(([key, name, format]) => (
            <li key={key}>
              {name}: {before ? `${format(before[key])} → ` : ''}
              {format(after[key])}
            </li>
          ))}
        </ul>
      ) : (
        <p>Sin cambios en las preferencias mostradas.</p>
      )}
    </div>
  );
}
export default function AuditView({
  fetchApi,
  query,
  refreshKey,
  navigate,
  href,
}: {
  fetchApi: SessionFetch;
  query: BiQuery;
  refreshKey: number;
  navigate: Navigate;
  href: DetailHref;
}) {
  const load = useCallback(
    (signal: AbortSignal) =>
      getBiAudit(
        fetchApi,
        { from: query.from, to: query.to, page: query.page, limit: 20 },
        signal,
      ),
    [fetchApi, query.from, query.to, query.page],
  );
  const resource = useBiResource(load, true, null, refreshKey);
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">Auditoría administrativa</h2>
      <RangeForm
        key={`${query.from}:${query.to}`}
        range={query}
        onApply={(range) => navigate({ ...range, page: '1' })}
      />
      {resource.loading && <Loading />}
      {Boolean(resource.error) && (
        <BiFailure
          error={resource.error}
          onRetry={resource.reload}
          retained={Boolean(resource.data)}
        />
      )}
      {resource.data && (
        <>
          {resource.data.items.length ? (
            <ul className="space-y-4">
              {resource.data.items.map((row) => (
                <li className="min-w-0 border p-5 text-sm" key={row.id}>
                  <h3 className="font-semibold">{names[row.action]}</h3>
                  <p className="mt-2">{timestamp(row.createdAt)}</p>
                  {row.requestId && (
                    <DetailLink href={href('request', row.requestId)}>
                      Ver solicitud
                    </DetailLink>
                  )}
                  {row.action === 'settings_updated' && (
                    <Changes
                      before={row.settingsBefore}
                      after={row.settingsAfter}
                    />
                  )}
                  <details className="mt-4">
                    <summary className="cursor-pointer py-2">
                      Detalles técnicos del registro
                    </summary>
                    <p className="mt-3 break-all text-muted-foreground">
                      Actor técnico: {row.actorId}
                    </p>
                    <p className="mt-2 break-all text-muted-foreground">
                      Registro: {row.id}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border p-5 text-sm">
              No hay acciones administrativas en este rango.
            </p>
          )}
          <BiPagination
            meta={resource.data.meta}
            label="auditoría"
            onChange={(page) => navigate({ page: String(page) })}
          />
        </>
      )}
    </section>
  );
}
