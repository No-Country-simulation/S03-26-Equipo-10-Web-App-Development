import { z } from 'zod';
import { moneyFromWire } from '../domain/money';

const capacity = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER)
  .nullable();
const days = z.number().int().min(0).max(2_147_483_647);
const minorAmount = z.string().superRefine((value, context) => {
  try {
    if (moneyFromWire(value, 'USD').amountMinor === 0n) throw new Error('zero');
  } catch {
    context.addIssue({
      code: 'custom',
      message:
        'Usá unidades menores enteras positivas dentro del rango BIGINT.',
    });
  }
});

export const planFeaturesSchema = z
  .object({
    media: z.boolean(),
    analytics: z.boolean(),
    scoring: z.boolean(),
    business_intelligence: z.boolean(),
    bi_statistics: z.boolean(),
    api_keys: z.boolean(),
    webhooks: z.boolean(),
  })
  .strict()
  .refine((value) => !value.bi_statistics || value.business_intelligence, {
    message: 'BI estadístico requiere BI.',
    path: ['bi_statistics'],
  });
export const planQuotasSchema = z
  .object({
    active_users: capacity,
    stored_testimonials: capacity,
    active_api_keys: capacity,
    active_webhooks: capacity,
  })
  .strict();
export const planPriceSchema = z
  .object({
    provider: z.enum(['stripe', 'mercadopago']),
    currency: z.enum(['USD', 'ARS']),
    interval: z.enum(['month', 'year']),
    amountMinor: minorAmount,
    modes: z
      .array(z.enum(['manual', 'automatic']))
      .min(1)
      .max(2),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      (value.provider === 'stripe' && value.currency !== 'USD') ||
      (value.provider === 'mercadopago' && value.currency !== 'ARS')
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Moneda no habilitada para este proveedor en v1.',
      });
    }
    if (new Set(value.modes).size !== value.modes.length)
      context.addIssue({ code: 'custom', message: 'Modalidad duplicada.' });
  });
export const planVersionDraftSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000),
    trialDays: days,
    graceDays: days.default(7),
    features: planFeaturesSchema,
    quotas: planQuotasSchema,
    prices: z.array(planPriceSchema).min(1).max(4),
  })
  .strict()
  .superRefine((value, context) => {
    const identities = value.prices.map(
      (price) => `${price.provider}:${price.currency}:${price.interval}`,
    );
    if (new Set(identities).size !== identities.length)
      context.addIssue({
        code: 'custom',
        message: 'Precio duplicado para proveedor, moneda y período.',
      });
  });

// Tenant, amount, seller, environment and return URLs come from trusted server
// state. Do not accept them as checkout input or silently strip extra fields.
export const checkoutRequestSchema = z
  .object({ priceId: z.uuid(), mode: z.enum(['manual', 'automatic']) })
  .strict();
export const trialRequestSchema = z
  .object({ planVersionId: z.uuid() })
  .strict();
export const changeSubscriptionSchema = checkoutRequestSchema;
export const cancelSubscriptionSchema = z.object({}).strict();
export const billingPolicySchema = z
  .object({
    enforcementEnabled: z.boolean(),
    expectedRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export const expectedRevisionSchema = z
  .object({
    expectedRevision: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER),
  })
  .strict();
export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9._~-]{1,128}$/);
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type PlanVersionDraft = z.infer<typeof planVersionDraftSchema>;
