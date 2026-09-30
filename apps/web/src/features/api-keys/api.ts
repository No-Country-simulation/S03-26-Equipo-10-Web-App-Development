import { z } from 'zod';
import { sessionRequest, type SessionFetch } from '@/lib/api/validated-response';

const apiKeySchema = z.object({
  id: z.string(), tenantId: z.string(), name: z.string(), isActive: z.boolean(),
  lastUsedAt: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
}).passthrough();
const createdKeySchema = z.object({ apiKey: z.string(), id: z.string(), name: z.string() }).passthrough();

export const listApiKeys = (fetchApi: SessionFetch) => sessionRequest(fetchApi, '/api-keys', z.array(apiKeySchema));
export const createApiKey = (fetchApi: SessionFetch, name: FormDataEntryValue | null) =>
  sessionRequest(fetchApi, '/api-keys', createdKeySchema, { method: 'POST', body: JSON.stringify({ name }) });
export const revokeApiKey = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(fetchApi, `/api-keys/${id}`, z.object({ id: z.string(), revoked: z.boolean() }), { method: 'DELETE' });
