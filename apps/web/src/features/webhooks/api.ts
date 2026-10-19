import { z } from 'zod';
import {
  sessionRequest,
  type SessionFetch,
} from '@/lib/api/validated-response';
import { pagePath, sessionPageRequest } from '@/features/shared/pagination';

export const webhookSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    url: z.string(),
    eventCode: z.string(),
    isActive: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    deletedAt: z.string().nullable().optional(),
    hasSignature: z.boolean(),
    signatureGraceUntil: z.string().nullable(),
    legacyHttp: z
      .object({ deadlineAt: z.string().nullable(), canDeliver: z.boolean() })
      .nullable()
      .optional(),
    legacyUnsigned: z
      .object({ deadlineAt: z.string().nullable(), canDeliver: z.boolean() })
      .nullable()
      .optional(),
    legacySignatureUntil: z.string().nullable().optional(),
  })
  .strip();
const revealedWebhookSchema = webhookSchema.extend({
  signingSecret: z.string().min(1),
});

export const listWebhooks = (fetchApi: SessionFetch, page = 1) =>
  sessionPageRequest(fetchApi, pagePath('/webhooks', page), webhookSchema);
export type CreateWebhookInput = { url: string; eventCode: string };
export const createWebhook = (
  fetchApi: SessionFetch,
  input: CreateWebhookInput,
) =>
  sessionRequest(fetchApi, '/webhooks', revealedWebhookSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const rotateWebhookSecret = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(
    fetchApi,
    `/webhooks/${id}/rotate-secret`,
    revealedWebhookSchema.refine((webhook) => webhook.id === id),
    { method: 'POST' },
  );
export const deleteWebhook = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(
    fetchApi,
    `/webhooks/${id}`,
    z.object({ id: z.literal(id), deleted: z.literal(true) }),
    {
      method: 'DELETE',
    },
  );
export const testWebhook = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(
    fetchApi,
    `/webhooks/${id}/test`,
    z.object({
      id: z.string().min(1),
      status: z.literal('accepted'),
    }),
    { method: 'POST' },
  );

const deliverySchema = z
  .object({
    id: z.string(),
    webhookId: z.string(),
    outboxEventId: z.string().nullable().optional(),
    errorMessage: z.string().nullable().optional(),
    status: z.string(),
    attempts: z.number().int().nonnegative(),
    responseCode: z.number().nullable(),
    createdAt: z.string(),
    attemptHistory: z
      .array(
        z.object({
          attemptNo: z.number(),
          status: z.string(),
          responseCode: z.number().nullable(),
          errorMessage: z.string().nullable(),
          startedAt: z.string(),
          completedAt: z.string().nullable(),
        }),
      )
      .optional(),
  })
  .passthrough();

export const listWebhookDeliveries = (
  fetchApi: SessionFetch,
  webhookId: string,
  page = 1,
) =>
  sessionPageRequest(
    fetchApi,
    pagePath(`/webhooks/${webhookId}/deliveries`, page),
    deliverySchema.refine((delivery) => delivery.webhookId === webhookId),
  );

export const replayWebhookDelivery = (
  fetchApi: SessionFetch,
  webhookId: string,
  deliveryId: string,
) =>
  sessionRequest(
    fetchApi,
    `/webhooks/${webhookId}/deliveries/${deliveryId}/replay`,
    z.object({
      id: z.literal(deliveryId),
      status: z.literal('pending'),
    }),
    { method: 'POST' },
  );

export type WebhookView = z.infer<typeof webhookSchema>;
export type DeliveryView = z.infer<typeof deliverySchema>;
export type UpdateWebhookInput = {
  url?: string;
  eventCode?: string;
  isActive?: boolean;
};
export const updateWebhook = (
  fetchApi: SessionFetch,
  id: string,
  input: UpdateWebhookInput,
) =>
  sessionRequest(
    fetchApi,
    `/webhooks/${id}`,
    webhookSchema.refine(
      (webhook) =>
        webhook.id === id &&
        (input.url === undefined || webhook.url === input.url) &&
        (input.eventCode === undefined ||
          webhook.eventCode === input.eventCode) &&
        (input.isActive === undefined || webhook.isActive === input.isActive),
    ),
    { method: 'PATCH', body: JSON.stringify(input) },
  );
