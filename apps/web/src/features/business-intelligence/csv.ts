import type { BiDashboard } from './api';
import { statusNames } from './format';
export type CsvReport = 'summary' | 'statuses' | 'categories' | 'daily';
const reportNames = { summary: 'resumen', statuses: 'estados', categories: 'categorias', daily: 'serie-diaria' };
type Cell = string | number | null;
function cell(value: Cell): string {
  let text = value === null ? '' : String(value);
  // Spreadsheet applications may ignore leading whitespace/control characters before a formula.
  if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]/u.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function buildBiCsv(data: BiDashboard, report: CsvReport) {
  const metaHeaders = ['desde_utc', 'hasta_utc', 'zona_horaria', 'corte_origen_utc', 'publicacion_utc'];
  const metadata: Cell[] = [data.range.from, data.range.to, 'UTC', data.freshness.sourceSnapshotAt, data.freshness.lastPublishedAt];
  let headers: string[]; let rows: Cell[][];
  switch (report) {
    case 'summary': headers = ['testimonios', 'rating_promedio', 'vistas', 'clics', 'reproducciones', 'ctr_porcentaje'];
      rows = [[data.summary.totalTestimonials, data.summary.averageRating, data.summary.views, data.summary.clicks, data.summary.plays, data.summary.ctr]]; break;
    case 'statuses': headers = ['estado', 'cantidad']; rows = data.summary.statuses.map(row => [statusNames[row.code] ?? row.code, row.count]); break;
    case 'categories': headers = ['categoria_id', 'categoria', 'cantidad', 'rating_promedio'];
      rows = data.categories.map(row => [row.categoryKey, row.name, row.count, row.averageRating]); break;
    case 'daily': headers = ['fecha_utc', 'corte_diario_utc', 'estado_corte', 'testimonios', 'rating_promedio', 'vistas', 'clics', 'reproducciones', 'ctr_porcentaje'];
      rows = data.testimonialSeries.map((row, index) => { const events = data.engagementSeries[index];
        return [row.date, row.snapshotAt, row.snapshotAt === null ? 'sin_corte' : 'observado', row.total, row.averageRating,
          events.views, events.clicks, events.plays, events.ctr]; }); break;
  }
  return { filename: `bi-${reportNames[report]}_${data.range.from}_${data.range.to}_UTC.csv`,
    content: '\uFEFF' + [[...metaHeaders, ...headers], ...rows.map(row => [...metadata, ...row])].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n' };
}
export function downloadBiCsv(data: BiDashboard, report: CsvReport) {
  const { filename, content } = buildBiCsv(data, report);
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor);
  anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
