import { z } from 'zod';
import { sessionRequest, type SessionFetch } from '@/lib/api/validated-response';
import { pagePath, paginatedSchema } from '@/features/shared/pagination';

const apiKeySchema = z.object({
  id: z.string(), tenantId: z.string(), name: z.string(), isActive: z.boolean(),
  publicId: z.string().nullable(), scopes: z.array(z.enum(['testimonials:read', 'analytics:write'])),
  status: z.enum(['ACTIVE', 'REVOKED', 'EXPIRED']), legacy: z.boolean(),
  expiresAt: z.string().nullable(), legacyDeadline: z.string().nullable(),
  lastUsedAt: z.string().nullable(), createdAt: z.string(), updatedAt: z.string(),
}).passthrough();
const createdKeySchema = z.object({ apiKey: z.string(), id: z.string(), name: z.string() }).passthrough();

export const listApiKeys = (fetchApi: SessionFetch, page = 1) =>
  sessionRequest(fetchApi, pagePath('/api-keys', page), paginatedSchema(apiKeySchema));
export type ApiKeyInput = { name: string; scopes: Array<'testimonials:read' | 'analytics:write'>; expiresAt?: string };
export const createApiKey = (fetchApi: SessionFetch, input: ApiKeyInput) =>
  sessionRequest(fetchApi, '/api-keys', createdKeySchema, { method: 'POST', body: JSON.stringify(input) });
export const rotateApiKey = (fetchApi: SessionFetch, id: string, input: ApiKeyInput) =>
  sessionRequest(fetchApi, `/api-keys/${id}/rotate`, createdKeySchema,
    { method: 'POST', body: JSON.stringify(input) });
export const revokeApiKey = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(fetchApi, `/api-keys/${id}`, z.object({ id: z.string(), revoked: z.boolean() }), { method: 'DELETE' });
