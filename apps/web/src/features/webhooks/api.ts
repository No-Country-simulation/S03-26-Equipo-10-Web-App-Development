import { z } from 'zod';
import { deletedSchema, sessionRequest, type SessionFetch } from '@/lib/api/validated-response';

const webhookSchema = z.object({
  id: z.string(), tenantId: z.string(), url: z.string(), eventCode: z.string(),
  isActive: z.boolean(), createdAt: z.string(), updatedAt: z.string(),
  deletedAt: z.string().nullable().optional(),
  hasSignature: z.boolean(),
  signatureGraceUntil: z.string().nullable(),
  legacyHttp: z.object({ deadlineAt: z.string().nullable(), canDeliver: z.boolean() }).nullable().optional(),
  legacyUnsigned: z.object({ deadlineAt: z.string().nullable(), canDeliver: z.boolean() }).nullable().optional(),
  legacySignatureUntil: z.string().nullable().optional(),
}).passthrough();
const revealedWebhookSchema = webhookSchema.extend({ signingSecret: z.string() });

export const listWebhooks = (fetchApi: SessionFetch) => sessionRequest(fetchApi, '/webhooks', z.object({
  items: z.array(webhookSchema),
  meta: z.object({ total: z.number(), page: z.number(), limit: z.number() }),
}));
export const createWebhook = (fetchApi: SessionFetch, input: object) =>
  sessionRequest(fetchApi, '/webhooks', revealedWebhookSchema, { method: 'POST', body: JSON.stringify(input) });
export const rotateWebhookSecret = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(fetchApi, `/webhooks/${id}/rotate-secret`, revealedWebhookSchema, { method: 'POST' });
export const deleteWebhook = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(fetchApi, `/webhooks/${id}`, deletedSchema, { method: 'DELETE' });
export const testWebhook = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(fetchApi, `/webhooks/${id}/test`, z.object({
    id: z.string(), status: z.literal('accepted'),
  }), { method: 'POST' });

const deliverySchema = z.object({
  id: z.string(), status: z.string(), attempts: z.number(),
  responseCode: z.number().nullable(), createdAt: z.string(),
  attemptHistory: z.array(z.object({
    attemptNo: z.number(), status: z.string(), responseCode: z.number().nullable(),
    errorMessage: z.string().nullable(), startedAt: z.string(), completedAt: z.string().nullable(),
  })).optional(),
}).passthrough();

export const listWebhookDeliveries = (fetchApi: SessionFetch, webhookId: string) =>
  sessionRequest(fetchApi, `/webhooks/${webhookId}/deliveries`, z.object({
    items: z.array(deliverySchema),
    meta: z.object({ total: z.number(), page: z.number(), limit: z.number() }),
  }));

export const replayWebhookDelivery = (fetchApi: SessionFetch, webhookId: string, deliveryId: string) =>
  sessionRequest(fetchApi, `/webhooks/${webhookId}/deliveries/${deliveryId}/replay`, z.object({
    id: z.string(), status: z.literal('pending'),
  }), { method: 'POST' });
