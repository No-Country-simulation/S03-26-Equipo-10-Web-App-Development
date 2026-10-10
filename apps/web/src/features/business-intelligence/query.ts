import { z } from 'zod';

export const biPath = '/admin/business-intelligence';
export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return value >= '0001-01-01' && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Fecha UTC inválida');
export function initialRange(now = new Date()) {
  const to = now.toISOString().slice(0, 10);
  return { from: new Date(Date.parse(to) - 29 * 86400000).toISOString().slice(0, 10), to };
}
export function rangeError(range: { from: string; to: string }, now = new Date()): string | null {
  const valid = z.object({ from: daySchema, to: daySchema }).safeParse(range);
  const days = (Date.parse(range.to) - Date.parse(range.from)) / 86400000 + 1;
  return !valid.success || !Number.isFinite(days) || days < 1 || days > 366 || range.to > now.toISOString().slice(0, 10)
    ? 'Seleccioná entre 1 y 366 días, hasta hoy, en UTC.' : null;
}
const page = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(10000));
const querySchema = z.object({ view: z.enum(['summary', 'runs', 'operation', 'settings', 'audit']).default('summary'),
  from: daySchema.optional(), to: daySchema.optional(), page: page.default('1'), requestPage: page.default('1'),
  status: z.enum(['running', 'succeeded', 'failed', 'abandoned']).optional(),
  origin: z.enum(['legacy', 'scheduled', 'cli', 'manual', 'retry']).optional(),
  requestStatus: z.enum(['pending', 'running', 'succeeded', 'failed', 'cancelled', 'expired', 'skipped']).optional(),
  run: z.string().uuid().optional(), request: z.string().uuid().optional(),
}).refine(value => !value.run || !value.request, 'Elegí un solo detalle');
export function parseBiQuery(params: URLSearchParams) {
  const values = Object.fromEntries(params);
  const result = querySchema.safeParse(values);
  if (!result.success) return { error: 'Los filtros del enlace no son válidos. Restablecé la vista.', query: null };
  const range = { ...initialRange(), ...(result.data.from ? { from: result.data.from } : {}), ...(result.data.to ? { to: result.data.to } : {}) };
  // When only an end date is shared, the default starts 29 days before that end date.
  if (!result.data.from && result.data.to) range.from = initialRange(new Date(`${result.data.to}T00:00:00Z`)).from;
  const error = rangeError(range);
  return error ? { error, query: null } : { error: null, query: { ...result.data, ...range } };
}
export type BiQuery = NonNullable<ReturnType<typeof parseBiQuery>['query']>;
const queryKeys = ['view', 'from', 'to', 'page', 'requestPage', 'status', 'origin', 'requestStatus', 'run', 'request'] as const;
export function biHref(params: URLSearchParams, changes: Partial<Record<typeof queryKeys[number], string | null>>) {
  const next = new URLSearchParams();
  for (const key of queryKeys) { const value = params.get(key); if (value !== null) next.set(key, value); }
  for (const [key, value] of Object.entries(changes)) { if (value === null) next.delete(key); else next.set(key, value); }
  const query = next.toString();
  return `${biPath}${query ? `?${query}` : ''}`;
}
