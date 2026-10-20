import type { BiStatistics } from './statistics-api';
export type StatisticsCsv = 'forecast' | 'patterns' | 'anomalies';
type Cell = string | number | boolean | null;
const percent = (value: number | null) => (value === null ? null : value * 100);
function cell(value: Cell): string {
  let text = value === null ? '' : String(value);
  if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]/u.test(text))
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function buildStatisticsCsv(data: BiStatistics, section: StatisticsCsv) {
  if (!data.publication) throw new Error('Publication required');
  const metaHeaders = [
    'algoritmo',
    'zona_horaria',
    'corte_origen_utc',
    'calculo_utc',
    'publicacion_estado',
    'vigencia',
    'seccion_estado',
    'motivo',
  ];
  const selected = data[section];
  const metadata: Cell[] = [
    data.algorithmVersion,
    'UTC',
    data.publication.sourceSnapshotAt,
    data.publication.generatedAt,
    data.publicationStatus,
    data.freshness.status,
    selected.status,
    selected.reason,
  ];
  let headers: string[];
  let rows: Cell[][];
  if (section === 'forecast') {
    const f = data.forecast;
    headers = [
      'tipo',
      'mes',
      'cantidad',
      'dias_observados',
      'dias_calendario',
      'cobertura_porcentaje',
      'parcial',
      'metodo',
      'horizonte',
      'meses_entrada',
      'origen_utc',
      'real',
      'candidato',
      'referencia',
      'mae_candidato',
      'mae_referencia',
      'sesgo_candidato',
      'sesgo_referencia',
    ];
    const common: Cell[] = [f.method, f.horizon, f.inputMonths.join('|')];
    const metrics: Cell[] = [
      f.evaluation?.candidateMae ?? null,
      f.evaluation?.baselineMae ?? null,
      f.evaluation?.candidateBias ?? null,
      f.evaluation?.baselineBias ?? null,
    ];
    rows = [
      [
        'pronostico',
        f.targetMonth,
        f.value,
        null,
        null,
        null,
        null,
        ...common,
        null,
        null,
        null,
        null,
        ...metrics,
      ],
      ...f.history.map((row) => [
        'historico',
        row.month,
        row.count,
        row.observedDays,
        row.calendarDays,
        percent(row.coverage),
        row.partial,
        ...common,
        null,
        null,
        null,
        null,
        ...metrics,
      ]),
      ...(f.evaluation?.folds.map((row) => [
        'evaluacion',
        row.targetMonth,
        null,
        null,
        null,
        null,
        null,
        ...common,
        row.originAt,
        row.actual,
        row.candidate,
        row.baseline,
        ...metrics,
      ]) ?? []),
    ];
  } else if (section === 'patterns') {
    const p = data.patterns;
    headers = [
      'tipo',
      'id',
      'nombre',
      'banda_rating',
      'cantidad',
      'porcentaje_inventario',
      'etiqueta_b',
      'soporte_porcentaje',
      'confianza_ab_porcentaje',
      'confianza_ba_porcentaje',
      'lift',
      'grupos_totales',
      'truncado',
      'disponibilidad',
      'motivo_fila',
      'inventario_total',
    ];
    rows = [];
    for (const [kind, list] of [
      ['categoria', p.categories],
      ['etiqueta', p.tags],
    ] as const) {
      rows.push([
        `${kind}_cobertura`,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        list.totalGroups,
        list.truncated,
        kind === 'etiqueta' ? p.tagsAvailability.status : p.status,
        kind === 'etiqueta' ? p.tagsAvailability.reason : p.reason,
        p.totalTestimonials,
      ]);
      for (const row of list.items)
        rows.push([
          kind,
          row.id,
          row.name,
          null,
          row.count,
          percent(row.ratio),
          null,
          null,
          null,
          null,
          null,
          list.totalGroups,
          list.truncated,
          null,
          null,
          p.totalTestimonials,
        ]);
    }
    for (const row of p.segments.items)
      rows.push([
        'segmento',
        row.categoryKey,
        row.name,
        row.band,
        row.count,
        percent(row.ratio),
        null,
        null,
        null,
        null,
        null,
        p.segments.totalGroups,
        p.segments.truncated,
        null,
        null,
        p.totalTestimonials,
      ]);
    rows.push([
      'segmento_cobertura',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      p.segments.totalGroups,
      p.segments.truncated,
      null,
      null,
      p.totalTestimonials,
    ]);
    rows.push([
      'asociaciones_cobertura',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      p.associationsAvailability.status,
      p.associationsAvailability.reason,
      p.totalTestimonials,
    ]);
    for (const row of p.associations)
      rows.push([
        'par',
        row.tagA,
        null,
        null,
        row.count,
        null,
        row.tagB,
        percent(row.support),
        percent(row.confidenceAB),
        percent(row.confidenceBA),
        row.lift,
        null,
        null,
        null,
        null,
        p.totalTestimonials,
      ]);
    for (const [kind, value] of [
      ['sin_categoria', p.withoutCategory],
      ['sin_etiquetas', p.withoutTags],
    ] as const)
      rows.push([
        kind,
        null,
        null,
        null,
        value?.count ?? null,
        percent(value?.ratio ?? null),
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        p.totalTestimonials,
      ]);
  } else {
    headers = [
      'desde_utc',
      'hasta_utc',
      'id',
      'dia_utc',
      'metrica',
      'corte_diario_utc',
      'provisional',
      'numerador',
      'denominador',
      'porcentaje',
      'dias_referencia',
      'mediana_porcentaje',
      'mad_porcentaje',
      'umbral_porcentaje',
      'estado',
    ];
    rows = data.anomalies.items.map((row) => [
      data.anomalies.from,
      data.anomalies.to,
      row.id,
      row.date,
      row.metric,
      row.snapshotAt,
      row.provisional,
      row.numerator,
      row.denominator,
      percent(row.ratio),
      row.baselineDays,
      percent(row.median),
      percent(row.mad),
      percent(row.threshold),
      row.status,
    ]);
  }
  return {
    filename: `bi-${section}_${data.publication.sourceSnapshotAt.slice(0, 10)}_UTC.csv`,
    content:
      '\uFEFF' +
      [
        [...metaHeaders, ...headers],
        ...rows.map((row) => [...metadata, ...row]),
      ]
        .map((row) => row.map(cell).join(','))
        .join('\r\n') +
      '\r\n',
  };
}
export function downloadStatisticsCsv(
  data: BiStatistics,
  section: StatisticsCsv,
) {
  const { filename, content } = buildStatisticsCsv(data, section);
  const url = URL.createObjectURL(
    new Blob([content], { type: 'text/csv;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
