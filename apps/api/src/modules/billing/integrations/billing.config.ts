import { z } from 'zod';

const endpoint = z.url().refine((value) => {
  const url = new URL(value);
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  );
});
const provider = z
  .object({
    accountId: z.uuid(),
    sellerId: z.string().min(1),
    credential: z.string().min(1),
    webhookSecrets: z.array(z.string().min(16)).min(1).max(2),
    // MP test sellers may use production-shaped credentials. Resource live_mode is
    // explicitly configured, never inferred from an access-token prefix.
    resourceLiveMode: z.boolean(),
    applicationId: z.string().min(1).optional(),
  })
  .strict();
const schema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('disabled') }),
  z.object({
    mode: z.literal('simulation'),
    returnUrl: z.url(),
    simulationKey: z.string().min(32),
  }),
  z
    .object({
      mode: z.literal('sandbox'),
      returnUrl: endpoint,
      notificationUrl: endpoint,
      stripe: provider.optional(),
      mercadopago: provider.optional(),
      mpSignatureToleranceSeconds: z
        .number()
        .int()
        .min(60)
        .max(86400)
        .default(900),
    })
    .refine((v) => !!v.stripe || !!v.mercadopago, 'BILLING_PROVIDER_REQUIRED'),
]);
export type BillingConfig = z.infer<typeof schema>;
export type ProviderSettings = z.infer<typeof provider>;
export const BILLING_CONFIG = Symbol('BILLING_CONFIG');

export function readBillingConfig(
  env: NodeJS.ProcessEnv = process.env,
): BillingConfig {
  const mode = env.BILLING_MODE || 'disabled';
  if (mode === 'disabled') return { mode: 'disabled' };
  // Live composition deliberately unavailable until external acceptance (phase 5).
  let value: unknown;
  try {
    value = JSON.parse(env.BILLING_CONFIG_JSON || '{}');
  } catch {
    throw new Error('BILLING_CONFIGURATION_INVALID');
  }
  const result = schema.safeParse({
    ...(typeof value === 'object' && value !== null ? value : {}),
    mode,
  });
  if (!result.success) throw new Error('BILLING_CONFIGURATION_INVALID');
  if (
    result.data.mode === 'sandbox' &&
    result.data.stripe &&
    (result.data.stripe.resourceLiveMode ||
      !/^(sk|rk)_test_/.test(result.data.stripe.credential))
  )
    throw new Error('BILLING_LIVE_DISABLED');
  if (result.data.mode === 'simulation' && env.NODE_ENV === 'production')
    throw new Error('BILLING_SIMULATION_FORBIDDEN');
  return result.data;
}
