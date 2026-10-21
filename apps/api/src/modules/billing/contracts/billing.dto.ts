import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import {
  planVersionDraftSchema,
  checkoutRequestSchema,
  trialRequestSchema,
  billingPolicySchema,
  expectedRevisionSchema,
  cancelSubscriptionSchema,
} from './billing.schemas';
export class BillingCheckoutDto extends createZodDto(checkoutRequestSchema) {}
export class BillingTrialDto extends createZodDto(trialRequestSchema) {}
export class BillingEmptyDto extends createZodDto(cancelSubscriptionSchema) {}
export class BillingPolicyDto extends createZodDto(billingPolicySchema) {}
export class BillingRevisionDto extends createZodDto(expectedRevisionSchema) {}
export class BillingPlanDto extends createZodDto(
  z.object({ code: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/) }).strict(),
) {}
export class BillingVersionDto extends createZodDto(planVersionDraftSchema) {}
export class BillingEditVersionDto extends createZodDto(
  z
    .object({
      expectedRevision: expectedRevisionSchema.shape.expectedRevision,
      draft: planVersionDraftSchema,
    })
    .strict(),
) {}
export class BillingAccountDto extends createZodDto(
  z
    .object({
      provider: z.enum(['stripe', 'mercadopago']),
      sellerId: z.string().min(1).max(100),
      applicationId: z.string().max(100).nullable(),
      configurationKey: z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/),
      enabled: z.boolean(),
    })
    .strict(),
) {}
export class BillingSyncDto extends createZodDto(
  z.object({ accountId: z.uuid(), priceId: z.uuid() }).strict(),
) {}
export class BillingReplayDto extends createZodDto(
  z.object({ kind: z.enum(['operation', 'inbox']) }).strict(),
) {}
export class BillingSimulationDto extends createZodDto(
  z
    .object({
      scenario: z.enum([
        'pending',
        'approved',
        'rejected',
        'partial_refund',
        'full_refund',
        'chargeback',
      ]),
      at: z.iso.datetime(),
      cycle: z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/),
    })
    .strict(),
) {}
