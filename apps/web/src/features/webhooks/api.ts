import { z } from 'zod';
import { deletedSchema, sessionRequest, type SessionFetch } from '@/lib/api/validated-response';

const webhookSchema = z.object({
  id: z.string(), tenantId: z.string(), url: z.string(), eventCode: z.string(),
  isActive: z.boolean(), createdAt: z.string(), updatedAt: z.string(),
  legacyHttp: z.object({ deadlineAt: z.string().nullable(), canDeliver: z.boolean() }).nullable().optional(),
}).passthrough();

export const listWebhooks = (fetchApi: SessionFetch) => sessionRequest(fetchApi, '/webhooks', z.object({
  items: z.array(webhookSchema),
  meta: z.object({ total: z.number(), page: z.number(), limit: z.number() }),
}));
export const createWebhook = (fetchApi: SessionFetch, input: object) =>
  sessionRequest(fetchApi, '/webhooks', webhookSchema, { method: 'POST', body: JSON.stringify(input) });
export const deleteWebhook = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(fetchApi, `/webhooks/${id}`, deletedSchema, { method: 'DELETE' });
export const testWebhook = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(fetchApi, `/webhooks/${id}/test`, z.undefined(), { method: 'POST' });
