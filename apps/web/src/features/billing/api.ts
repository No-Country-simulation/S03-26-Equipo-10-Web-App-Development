import { z } from 'zod';
import {
  sessionRequest,
  type SessionFetch,
} from '@/lib/api/validated-response';
const integer = z.string().regex(/^(0|[1-9]\d*)$/);
export const featureNames = {
  media: 'Imágenes y video',
  analytics: 'Analítica',
  scoring: 'Scoring',
  business_intelligence: 'Inteligencia de negocio',
  bi_statistics: 'Estadística avanzada',
  api_keys: 'API keys',
  webhooks: 'Webhooks',
} as const;
export const quotaNames = {
  active_users: 'Usuarios activos',
  stored_testimonials: 'Testimonios guardados',
  active_api_keys: 'API keys vigentes',
  active_webhooks: 'Destinos webhook activos',
} as const;
export type Quota = keyof typeof quotaNames;
const features = z.object({
  media: z.boolean(),
  analytics: z.boolean(),
  scoring: z.boolean(),
  business_intelligence: z.boolean(),
  bi_statistics: z.boolean(),
  api_keys: z.boolean(),
  webhooks: z.boolean(),
});
const quotas = z.object({
  active_users: z.number().int().nonnegative().nullable(),
  stored_testimonials: z.number().int().nonnegative().nullable(),
  active_api_keys: z.number().int().nonnegative().nullable(),
  active_webhooks: z.number().int().nonnegative().nullable(),
});
const usage = z.object({
  active_users: z.number().int().nonnegative(),
  stored_testimonials: z.number().int().nonnegative(),
  active_api_keys: z.number().int().nonnegative(),
  active_webhooks: z.number().int().nonnegative(),
});
export const priceSchema = z.object({
  id: z.string().uuid(),
  provider: z.enum(['stripe', 'mercadopago']),
  currency: z.enum(['ARS', 'USD']),
  interval: z.enum(['month', 'year']),
  amountMinor: integer,
  modes: z.array(z.enum(['manual', 'automatic'])),
  ready: z.boolean(),
});
export const versionSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  version: z.number().int(),
  revision: z.number().int(),
  status: z.enum(['draft', 'published', 'archived']),
  name: z.string(),
  description: z.string(),
  trialDays: z.number().int(),
  graceDays: z.number().int(),
  features,
  quotas,
  prices: z.array(priceSchema),
});
export const catalogSchema = z.array(
  z.object({
    id: z.string().uuid(),
    code: z.string(),
    archived: z.boolean(),
    versions: z.array(versionSchema),
  }),
);
export const summarySchema = z.object({
  runtime: z.enum(['disabled', 'simulation', 'sandbox']),
  isOperator: z.boolean(),
  enforcementEnabled: z.boolean(),
  revision: z.number().int(),
  trialConsumed: z.boolean(),
  pendingOperationId: z.string().uuid().nullable().optional(),
  access: z.object({
    mode: z.enum(['unrestricted', 'trial', 'paid', 'grace', 'read_only']),
    canMutate: z.boolean(),
  }),
  plan: z
    .object({ id: z.string().uuid(), name: z.string(), graceDays: z.number() })
    .nullable(),
  features: features.nullable(),
  quotas,
  usage: usage.nullable(),
  coverage: z
    .object({
      startsAt: z.string(),
      endsAt: z.string(),
      graceEndsAt: z.string().nullable(),
    })
    .nullable()
    .optional(),
  subscription: z
    .object({
      id: z.string().uuid(),
      status: z.string(),
      mode: z.enum(['manual', 'automatic']),
      paidThrough: z.string().nullable(),
      renewalStoppedAt: z.string().nullable(),
      price: priceSchema.pick({
        id: true,
        provider: true,
        currency: true,
        interval: true,
        amountMinor: true,
      }),
    })
    .nullable(),
  change: z
    .object({
      id: z.string().uuid(),
      status: z.string(),
      targetPriceId: z.string().uuid(),
      targetMode: z.enum(['manual', 'automatic']),
      effectiveAt: z.string(),
    })
    .nullable(),
});
export type BillingSummary = z.infer<typeof summarySchema>;
export type Catalog = z.infer<typeof catalogSchema>;
export type Version = z.infer<typeof versionSchema>;
export const operationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['ready', 'processing', 'succeeded', 'uncertain', 'review']),
  kind: z.string(),
  errorCode: z.string().nullable(),
  paymentStatus: z.enum([
    'pending',
    'confirmed',
    'failed',
    'reversed',
    'expired',
  ]),
  redirectUrl: z.string().url().optional(),
  redirectUnavailable: z.boolean().optional(),
});
const paymentSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  amountMinor: integer,
  refundedMinor: integer,
  currency: z.enum(['ARS', 'USD']),
  observedAt: z.string(),
});
export const loadSummary = (f: SessionFetch) =>
  sessionRequest(f, '/billing/summary', summarySchema);
export const loadEntitlements = (f: SessionFetch) =>
  sessionRequest(f, '/billing/entitlements', summarySchema);
export const loadCatalog = (f: SessionFetch, platform = false) =>
  sessionRequest(
    f,
    platform ? '/platform/billing/catalog' : '/billing/catalog',
    catalogSchema,
  );
export const loadOperation = (f: SessionFetch, id: string) =>
  sessionRequest(
    f,
    `/billing/operations/${encodeURIComponent(id)}`,
    operationSchema,
  );
export const loadPayments = (f: SessionFetch, page = 1) =>
  sessionRequest(
    f,
    `/billing/payments?page=${page}&limit=20`,
    z.object({
      items: z.array(paymentSchema),
      total: z.number().int(),
      page: z.number().int(),
      limit: z.number().int(),
    }),
  );
export function billingMutation(
  f: SessionFetch,
  path: string,
  payload: unknown,
  key: string,
  method = 'POST',
) {
  return sessionRequest(f, path, z.unknown(), {
    method,
    headers: { 'Idempotency-Key': key },
    body: JSON.stringify(payload),
  });
}
export const operationAccepted = z.object({ operationId: z.string().uuid() });
export const platformSchema = z.object({
  runtime: z.enum(['simulation', 'sandbox']),
  accounts: z.array(
    z.object({
      id: z.string().uuid(),
      provider: z.enum(['stripe', 'mercadopago']),
      environment: z.string(),
      sellerId: z.string(),
      applicationId: z.string().nullable(),
      configurationKey: z.string(),
      enabled: z.boolean(),
    }),
  ),
  operations: z.array(
    z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid().nullable(),
      kind: z.string(),
      status: z.string(),
      attempts: z.number(),
      errorCode: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  inbox: z.array(
    z.object({
      id: z.string().uuid(),
      topic: z.string(),
      status: z.string(),
      attempts: z.number(),
      errorCode: z.string().nullable(),
      receivedAt: z.string(),
    }),
  ),
  discrepancies: z.array(
    z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid().nullable(),
      entityId: z.string().uuid(),
      action: z.enum(['payment.additional', 'ledger.review']),
      createdAt: z.string(),
    }),
  ),
  payments: z.array(paymentSchema.extend({ tenantId: z.string().uuid() })),
});
export const loadPlatform = (f: SessionFetch) =>
  sessionRequest(f, '/platform/billing', platformSchema);
