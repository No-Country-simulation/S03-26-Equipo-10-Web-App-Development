'use client';
import { useCallback, useState, type ReactNode } from 'react';
import type { SessionFetch } from '@/lib/api/validated-response';
import { Button } from '@/components/ui/button';
import { getBiStatistics, type BiStatistics } from '../statistics-api';
import { downloadStatisticsCsv, type StatisticsCsv } from '../statistics-csv';
import { useBiResource } from '../use-bi-resource';
import { number, percentage, rating, timestamp } from '../format';
import { BiFailure, Loading } from '../components/shared';
import {
  MonthlyStatisticsChart,
  AnomalyStatisticsChart,
} from '../components/statistics-charts';

const reasons = new Map<string, string>([
  ['NOT_LOADED', 'Todavía no hay un informe estadístico publicado.'],
  [
    'INSUFFICIENT_HISTORY',
    'Se requieren 12 meses cerrados consecutivos posteriores al inicio de observación.',
  ],
  [
    'INSUFFICIENT_COVERAGE',
    'La cobertura no alcanza el 90 % de los días en cada mes requerido.',
  ],
  [
    'MISSING_EVALUATION_ORIGIN',
    'Faltan cortes para reconstruir las seis evaluaciones históricas.',
  ],
  [
    'BASELINE_PERFECT',
    'La referencia no tuvo error histórico; se conserva sólo el histórico.',
  ],
  [
    'NO_BASELINE_IMPROVEMENT',
    'El promedio móvil no reduce el error de la referencia al menos un 10 %.',
  ],
  [
    'INSUFFICIENT_SAMPLE',
    'Se requieren al menos 30 testimonios en el corte para este análisis.',
  ],
  [
    'INSUFFICIENT_BASELINE',
    'Faltan al menos 21 días válidos en los 28 días anteriores.',
  ],
  [
    'TAGS_NOT_OBSERVED',
    'Este corte todavía no incluye observación de etiquetas.',
  ],
  [
    'STALE_PUBLICATION',
    'El informe está atrasado. Actualizá las cargas antes de usar una proyección.',
  ],
  [
    'TARGET_OUTDATED',
    'El mes objetivo ya no corresponde al próximo mes calendario. Se conserva el histórico.',
  ],
]);
export const statisticsReason = (reason: string | null) =>
  reason ? (reasons.get(reason) ?? 'Análisis no disponible.') : null;
const pct = (value: number | null) =>
  percentage(value === null ? null : value * 100);
const band = { low: 'Bajo (1–2)', medium: 'Medio (3)', high: 'Alto (4–5)' };
const metricName = (metric: string) =>
  metric === 'rejected_share' ? 'Rechazados' : 'Valoraciones bajas';
const signalStatus = {
  no_snapshot: 'Sin corte',
  insufficient_sample: 'Muestra insuficiente',
  insufficient_baseline: 'Referencia insuficiente',
  normal: 'Sin aumento señalado',
  flagged: 'Aumento señalado',
};
function DataTable({
  caption,
  columns,
  children,
}: {
  caption: string;
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div
      className="my-4 max-w-full overflow-x-auto"
      role="region"
      aria-label={caption}
      tabIndex={0}
    >
      <table className="w-full text-left text-sm tabular-nums">
        <caption className="pb-3 text-left font-medium">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="whitespace-nowrap border-b px-3 py-3"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_td]:border-b [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_td]:break-words">
          {children}
        </tbody>
      </table>
    </div>
  );
}
function FrequencyTable({
  title,
  list,
}: {
  title: string;
  list: BiStatistics['patterns']['categories'];
}) {
  return (
    <div className="min-w-0">
      <DataTable
        caption={title}
        columns={['Tema', 'Testimonios', '% del inventario']}
      >
        {list.items.map((row) => (
          <tr key={row.id}>
            <td className="max-w-xs">{row.name}</td>
            <td>{number(row.count)}</td>
            <td>
              {pct(row.ratio)}
              <div className="mt-2 h-1 bg-muted" aria-hidden="true">
                <div
                  className="h-1 bg-primary"
                  style={{ width: `${row.ratio * 100}%` }}
                />
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
      {list.items.length === 0 && (
        <p className="text-sm">Sin frecuencias observadas.</p>
      )}
      <p className="text-sm text-muted-foreground">
        {number(list.totalGroups)} grupos.{' '}
        {list.truncated
          ? 'Se muestran los 50 más frecuentes; los porcentajes usan el inventario completo.'
          : 'Se muestran todos los grupos observados.'}
      </p>
    </div>
  );
}
export default function StatisticsView({
  fetchApi,
  refreshKey,
}: {
  fetchApi: SessionFetch;
  refreshKey: number;
}) {
  const load = useCallback(
    async (signal: AbortSignal) =>
      (await getBiStatistics(fetchApi, signal)).data,
    [fetchApi],
  );
  const resource = useBiResource(load, true, null, refreshKey);
  const data = resource.data;
  const [exportError, setExportError] = useState('');
  const disabled =
    !data?.publication || Boolean(resource.error) || resource.refreshing;
  function exportCsv(section: StatisticsCsv) {
    if (!data || disabled) return;
    try {
      downloadStatisticsCsv(data, section);
      setExportError('');
    } catch {
      setExportError('No se pudo descargar el archivo. Volvé a intentar.');
    }
  }
  const csv = (section: StatisticsCsv, label: string) => (
    <Button
      type="button"
      variant="outline"
      disabled={disabled}
      onClick={() => exportCsv(section)}
      aria-describedby={
        !data?.publication ? 'statistics-download-reason' : undefined
      }
    >
      {label} CSV
    </Button>
  );
  return (
    <div className="mt-7 min-w-0">
      <h2 className="text-2xl font-semibold">Analítica estadística</h2>
      <p className="mt-3 max-w-prose text-sm">
        Creaciones observadas, temas de tu taxonomía y cambios para revisar.
        Cada sección usa la ventana indicada aquí; los filtros del resumen no se
        aplican.
      </p>
      {resource.loading && <Loading>Cargando analítica estadística…</Loading>}
      {resource.refreshing && data && (
        <p role="status" className="mt-3 text-sm">
          Actualizando informe…
        </p>
      )}
      {Boolean(resource.error) && (
        <BiFailure
          error={resource.error}
          onRetry={resource.reload}
          retained={Boolean(data)}
        />
      )}
      {exportError && (
        <p role="alert" className="mt-3 text-sm">
          {exportError}
        </p>
      )}
      {data && (
        <>
          <div
            className="mt-5 space-y-2 border-y py-4 text-sm"
            aria-label="Procedencia y vigencia estadística"
          >
            <p>
              Corte fuente:{' '}
              {timestamp(data.publication?.sourceSnapshotAt ?? null)} · Cálculo:{' '}
              {timestamp(data.publication?.generatedAt ?? null)}.
            </p>
            <p>
              Estado:{' '}
              {data.publicationStatus === 'current'
                ? 'Informe del último corte'
                : data.publicationStatus === 'outdated'
                  ? 'Informe de un corte anterior'
                  : data.publicationStatus === 'pending'
                    ? 'Corte disponible, informe pendiente'
                    : 'Sin cortes observados'}
              . Vigencia:{' '}
              {data.freshness.status === 'fresh'
                ? 'Dentro del plazo'
                : data.freshness.status === 'stale'
                  ? 'Datos vencidos'
                  : 'Sin datos'}
              .
            </p>
            <p>
              Edad del corte:{' '}
              {data.freshness.dataAgeSeconds === null
                ? 'Sin datos'
                : `${rating(data.freshness.dataAgeSeconds / 3600)} h`}
              . Plazo de vigencia:{' '}
              {rating(data.freshness.staleAfterSeconds / 3600)} h.
              {data.freshness.schedulePaused &&
                ' Programación pausada; los datos siguen envejeciendo.'}
            </p>
            <p>
              Inicio de observación: {timestamp(data.coverage.historyStartedAt)}
              . Etiquetas desde: {timestamp(data.coverage.tagHistoryStartedAt)}.
              UTC · {data.algorithmVersion}.
            </p>
            {(data.publicationStatus === 'outdated' ||
              data.freshness.status === 'stale') && (
              <p role="status" className="font-medium">
                Datos anteriores para consulta histórica. Las señales no
                representan alertas actuales.
              </p>
            )}
            {!data.publication && (
              <p id="statistics-download-reason">
                Los CSV estarán disponibles cuando se publique el primer
                informe.
              </p>
            )}
          </div>
          <section className="mt-8" aria-labelledby="statistics-forecast">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 id="statistics-forecast" className="text-xl font-semibold">
                Pronóstico mensual
              </h3>
              {csv('forecast', 'Pronóstico')}
            </div>
            <p className="mt-3 max-w-prose text-sm">
              Objetivo: {data.forecast.targetMonth} UTC. Creaciones distintas
              que BI alcanzó a observar; un alta eliminada entre cargas puede
              faltar. El mes en curso queda fuera del ajuste.
            </p>
            {data.forecast.value !== null ? (
              <p className="mt-4 text-lg font-medium">
                Estimación: aproximadamente{' '}
                {Math.round(data.forecast.value).toLocaleString('es-AR')}{' '}
                testimonios.
              </p>
            ) : (
              <p role="status" className="mt-4 text-sm">
                {statisticsReason(data.forecast.reason)}
              </p>
            )}
            <p className="mt-3 text-sm">
              Promedio de tres meses cerrados, constante a dos pasos. Meses
              utilizados:{' '}
              {data.forecast.inputMonths.join(', ') || 'Sin ajuste disponible'}.
            </p>
            {data.forecast.history.length > 0 && (
              <>
                <MonthlyStatisticsChart forecast={data.forecast} />
                <DataTable
                  caption="Histórico de creaciones observadas (hasta 24 meses UTC)"
                  columns={[
                    'Mes',
                    'Creaciones',
                    'Días con corte',
                    'Cobertura',
                    'Período',
                  ]}
                >
                  {data.forecast.history.map((row) => (
                    <tr key={row.month}>
                      <td>{row.month}</td>
                      <td>
                        {row.count === null
                          ? 'Desconocidas'
                          : number(row.count)}
                      </td>
                      <td>
                        {row.observedDays} /{' '}
                        {row.month ===
                        data.publication?.sourceSnapshotAt.slice(0, 7)
                          ? new Date(
                              data.publication.sourceSnapshotAt,
                            ).getUTCDate()
                          : row.calendarDays}
                      </td>
                      <td>{pct(row.coverage)}</td>
                      <td>{row.partial ? 'Parcial' : 'Cerrado'}</td>
                    </tr>
                  ))}
                </DataTable>
              </>
            )}
            {data.forecast.evaluation && (
              <details className="mt-4 text-sm">
                <summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                  Evaluación histórica del pronóstico
                </summary>
                <p>
                  Error absoluto medio: promedio móvil{' '}
                  {rating(data.forecast.evaluation.candidateMae)}; último valor{' '}
                  {rating(data.forecast.evaluation.baselineMae)}{' '}
                  testimonios/mes.
                </p>
                <p>
                  Sesgo: promedio móvil{' '}
                  {rating(data.forecast.evaluation.candidateBias)}; último valor{' '}
                  {rating(data.forecast.evaluation.baselineBias)}. Positivo
                  indica sobreestimación.
                </p>
                <DataTable
                  caption="Seis evaluaciones históricas al mismo horizonte"
                  columns={[
                    'Objetivo',
                    'Origen UTC',
                    'Real observado',
                    'Promedio móvil',
                    'Último valor',
                  ]}
                >
                  {data.forecast.evaluation.folds.map((row) => (
                    <tr key={row.targetMonth}>
                      <td>{row.targetMonth}</td>
                      <td>{timestamp(row.originAt)}</td>
                      <td>{number(row.actual)}</td>
                      <td>{rating(row.candidate)}</td>
                      <td>{rating(row.baseline)}</td>
                    </tr>
                  ))}
                </DataTable>
                <p>
                  La mejora histórica no garantiza resultados futuros. No se
                  estimaron intervalos de predicción.
                </p>
              </details>
            )}
          </section>
          <section
            className="mt-10 border-t pt-7"
            aria-labelledby="statistics-patterns"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 id="statistics-patterns" className="text-xl font-semibold">
                Minería de patrones
              </h3>
              {csv('patterns', 'Patrones')}
            </div>
            <p className="mt-3 text-sm">
              Último corte del informe · Inventario:{' '}
              {data.patterns.totalTestimonials === null
                ? 'Desconocido'
                : number(data.patterns.totalTestimonials)}{' '}
              testimonios. Temas ya definidos por el equipo; segmentos por
              reglas, sin análisis automático del texto ni causalidad.
            </p>
            {data.patterns.reason && (
              <p className="mt-3 text-sm">
                {statisticsReason(data.patterns.reason)}
              </p>
            )}
            <p className="mt-3 text-sm">
              Sin categoría:{' '}
              {data.patterns.withoutCategory
                ? `${number(data.patterns.withoutCategory.count)} (${pct(data.patterns.withoutCategory.ratio)})`
                : 'Desconocido'}
              . Sin etiquetas:{' '}
              {data.patterns.withoutTags
                ? `${number(data.patterns.withoutTags.count)} (${pct(data.patterns.withoutTags.ratio)})`
                : 'Desconocido'}
              .
            </p>
            <div className="mt-5 grid min-w-0 gap-7 lg:grid-cols-2">
              <FrequencyTable
                title="Categorías frecuentes"
                list={data.patterns.categories}
              />
              <div className="min-w-0">
                {data.patterns.tagsAvailability.reason && (
                  <p className="text-sm">
                    {statisticsReason(data.patterns.tagsAvailability.reason)}
                  </p>
                )}
                <FrequencyTable
                  title="Etiquetas frecuentes"
                  list={data.patterns.tags}
                />
                <p className="mt-2 text-sm">
                  Un testimonio puede tener varias etiquetas: sus porcentajes
                  pueden sumar más del 100 %.
                </p>
              </div>
            </div>
            <DataTable
              caption="Segmentos recurrentes por categoría y banda de rating"
              columns={[
                'Categoría',
                'Rating',
                'Integrantes',
                '% del inventario',
              ]}
            >
              {data.patterns.segments.items.map((row) => (
                <tr key={`${row.categoryKey}:${row.band}`}>
                  <td>{row.name}</td>
                  <td>{band[row.band]}</td>
                  <td>{number(row.count)}</td>
                  <td>{pct(row.ratio)}</td>
                </tr>
              ))}
            </DataTable>
            <p className="text-sm">
              {data.patterns.segments.items.length
                ? 'Grupos con al menos cinco integrantes.'
                : 'Sin segmentos con al menos cinco integrantes.'}{' '}
              {data.patterns.segments.truncated &&
                'Se muestran hasta 50 segmentos.'}
            </p>
            <h4 className="mt-7 font-medium">Etiquetas que aparecen juntas</h4>
            <p className="mt-2 text-sm">
              Hasta 20 pares entre las 50 etiquetas más frecuentes: al menos
              cinco testimonios, soporte del 5 % y lift de 1,2. A→B indica qué
              parte de A también tiene B.
            </p>
            {data.patterns.associationsAvailability.reason && (
              <p className="mt-3 text-sm">
                {statisticsReason(
                  data.patterns.associationsAvailability.reason,
                )}
              </p>
            )}
            <DataTable
              caption="Asociaciones exploratorias de etiquetas"
              columns={[
                'Etiqueta A',
                'Etiqueta B',
                'Juntas',
                'Soporte',
                'Confianza A→B',
                'Confianza B→A',
                'Lift',
              ]}
            >
              {data.patterns.associations.map((row) => (
                <tr key={`${row.tagA}:${row.tagB}`}>
                  <td>
                    {data.patterns.tags.items.find((tag) => tag.id === row.tagA)
                      ?.name ?? row.tagA}
                  </td>
                  <td>
                    {data.patterns.tags.items.find((tag) => tag.id === row.tagB)
                      ?.name ?? row.tagB}
                  </td>
                  <td>{number(row.count)}</td>
                  <td>{pct(row.support)}</td>
                  <td>{pct(row.confidenceAB)}</td>
                  <td>{pct(row.confidenceBA)}</td>
                  <td>{rating(row.lift)}</td>
                </tr>
              ))}
            </DataTable>
            {data.patterns.associationsAvailability.status === 'available' &&
              !data.patterns.associations.length && (
                <p className="text-sm">
                  No hay pares que cumplan los criterios.
                </p>
              )}
          </section>
          <section
            className="mt-10 border-t pt-7"
            aria-labelledby="statistics-anomalies"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 id="statistics-anomalies" className="text-xl font-semibold">
                Detección de anomalías
              </h3>
              {csv('anomalies', 'Anomalías')}
            </div>
            <p className="mt-3 max-w-prose text-sm">
              {data.anomalies.from} a {data.anomalies.to} UTC · Último corte de
              cada día. Señales exploratorias para revisión sobre rechazados y
              rating 1–2, incluyendo todos los estados.
            </p>
            <p className="mt-3 max-w-prose text-sm">
              Referencia: 28 días anteriores, con al menos 21 observaciones
              válidas y 30 testimonios por corte. Umbral: mediana + máximo entre
              5 puntos porcentuales y 3 × 1,4826 × MAD. Los snapshots se
              solapan: no se atribuye significancia ni causalidad.
            </p>
            {data.anomalies.reason && (
              <p role="status" className="mt-3 text-sm">
                {statisticsReason(data.anomalies.reason)}
              </p>
            )}
            {data.anomalies.items.length > 0 && (
              <>
                <AnomalyStatisticsChart anomalies={data.anomalies} />
                <p className="text-sm font-medium">
                  {
                    data.anomalies.items.filter(
                      (row) => row.status === 'flagged',
                    ).length
                  }{' '}
                  aumentos señalados en el período. Línea continua: rechazados;
                  discontinua: valoraciones bajas.
                </p>
                <details className="mt-4">
                  <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                    Consultar las señales y referencias de los 90 días
                  </summary>
                  <DataTable
                    caption="Señales diarias y referencia estadística"
                    columns={[
                      'Día UTC',
                      'Métrica',
                      'Proporción',
                      'Numerador / total',
                      'Días ref.',
                      'Mediana',
                      'MAD',
                      'Umbral',
                      'Resultado',
                      'Corte UTC',
                    ]}
                  >
                    {data.anomalies.items.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {row.date}
                          {row.provisional ? ' (provisional)' : ''}
                        </td>
                        <td>{metricName(row.metric)}</td>
                        <td>{pct(row.ratio)}</td>
                        <td>
                          {row.numerator === null || row.denominator === null
                            ? 'Desconocido'
                            : `${number(row.numerator)} / ${number(row.denominator)}`}
                        </td>
                        <td>{row.baselineDays}</td>
                        <td>{pct(row.median)}</td>
                        <td>{pct(row.mad)}</td>
                        <td>{pct(row.threshold)}</td>
                        <td
                          className={
                            row.status === 'flagged' ? 'font-semibold' : ''
                          }
                        >
                          {signalStatus[row.status]}
                        </td>
                        <td>{timestamp(row.snapshotAt)}</td>
                      </tr>
                    ))}
                  </DataTable>
                </details>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
