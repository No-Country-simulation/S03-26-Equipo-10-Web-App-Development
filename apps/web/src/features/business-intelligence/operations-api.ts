import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { sessionRequest, type SessionFetch } from '@/lib/api/validated-response';
import { actionSchema, auditSchema, operationsMetaSchema, receiptSchema, requestDetailSchema, requestInputSchema,
  requestSchema, runDetailSchema, runSchema, settingsInputSchema, settingsSchema, statusSchema,
  type BiPage, type RequestInput, type SettingsInput } from './operations-schemas';

export interface HistoryFilter { from: string; to: string; page: number; limit: number }
export interface RunFilter extends HistoryFilter { status?: z.infer<typeof runSchema>['status']; origin?: z.infer<typeof runSchema>['origin'] }
export interface RequestFilter extends HistoryFilter { status?: z.infer<typeof requestSchema>['status'] }
function historyQuery(filter: HistoryFilter & { status?: string; origin?: string }) {
  const params = new URLSearchParams({ from: filter.from, to: filter.to, page: String(filter.page), limit: String(filter.limit) });
  if (filter.status) params.set('status', filter.status);
  if (filter.origin) params.set('origin', filter.origin);
  return params.toString();
}
async function list<T extends z.ZodTypeAny>(fetchApi: SessionFetch, path: string, schema: T, signal?: AbortSignal): Promise<BiPage<z.infer<T>>> {
  const response = await sessionRequest(fetchApi, path, z.array(schema).max(100), { signal });
  const meta = operationsMetaSchema.safeParse(response.meta);
  if (!meta.success || response.data.length > meta.data.limit) throw new ApiError('El servidor devolvió una paginación inválida.', 'INVALID_RESPONSE');
  return { items: response.data, meta: meta.data };
}
export const getBiStatus = (fetchApi: SessionFetch, signal?: AbortSignal) => sessionRequest(fetchApi, '/bi/status', statusSchema, { signal });
export const getBiSettings = (fetchApi: SessionFetch, signal?: AbortSignal) => sessionRequest(fetchApi, '/bi/settings', settingsSchema, { signal });
export const getBiRuns = (fetchApi: SessionFetch, filter: RunFilter, signal?: AbortSignal) => list(fetchApi, `/bi/runs?${historyQuery(filter)}`, runSchema, signal);
export const getBiRequests = (fetchApi: SessionFetch, filter: RequestFilter, signal?: AbortSignal) => list(fetchApi, `/bi/requests?${historyQuery(filter)}`, requestSchema, signal);
export const getBiAudit = (fetchApi: SessionFetch, filter: HistoryFilter, signal?: AbortSignal) => list(fetchApi, `/bi/audit?${historyQuery(filter)}`, auditSchema, signal);
const resourceId = (id: string) => encodeURIComponent(z.string().uuid().parse(id));
export const getBiRun = (fetchApi: SessionFetch, id: string, signal?: AbortSignal) => sessionRequest(fetchApi, `/bi/runs/${resourceId(id)}`, runDetailSchema, { signal });
export const getBiRequest = (fetchApi: SessionFetch, id: string, signal?: AbortSignal) => sessionRequest(fetchApi, `/bi/requests/${resourceId(id)}`, requestDetailSchema, { signal });
export const patchBiSettings = (fetchApi: SessionFetch, input: SettingsInput) => sessionRequest(fetchApi, '/bi/settings', settingsSchema,
  { method: 'PATCH', body: JSON.stringify(settingsInputSchema.parse(input)) });
const idempotencyKey = (key: string) => z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/).parse(key);
export const createBiRequest = (fetchApi: SessionFetch, input: RequestInput, key: string) => sessionRequest(fetchApi, '/bi/requests', receiptSchema,
  { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey(key) }, body: JSON.stringify(requestInputSchema.parse(input)) });
export const cancelBiRequest = (fetchApi: SessionFetch, id: string, key: string) => sessionRequest(fetchApi, `/bi/requests/${resourceId(id)}/cancel`, requestSchema,
  { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey(key) }, body: '{}' });
export type { BiPage, RequestInput, SettingsInput };
export type AllowedAction = z.infer<typeof actionSchema>;
