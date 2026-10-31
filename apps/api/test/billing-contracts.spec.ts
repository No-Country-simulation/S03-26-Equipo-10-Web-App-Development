import {
  checkoutRequestSchema,
  planVersionDraftSchema,
  idempotencyKeySchema,
  trialRequestSchema,
} from '../src/modules/billing/contracts/billing.schemas';

const planVersionId = '11111111-1111-4111-8111-111111111111';
const plan = () => ({
  name: 'Plan sintético',
  description: 'Sólo simulación',
  trialDays: 14,
  features: {
    media: true,
    analytics: true,
    scoring: false,
    business_intelligence: true,
    bi_statistics: true,
    api_keys: true,
    webhooks: true,
  },
  quotas: {
    active_users: 2,
    stored_testimonials: 10,
    active_api_keys: null,
    active_webhooks: 0,
  },
  prices: [
    {
      provider: 'stripe',
      currency: 'USD',
      interval: 'month',
      amountMinor: '1999',
      modes: ['manual', 'automatic'],
    },
  ],
});

describe('billing boundary schemas', () => {
  it('defaults grace to seven days and preserves explicit unlimited/zero quotas', () => {
    const result = planVersionDraftSchema.parse(plan());
    expect(result.graceDays).toBe(7);
    expect(result.quotas).toEqual({
      active_users: 2,
      stored_testimonials: 10,
      active_api_keys: null,
      active_webhooks: 0,
    });
    expect(result.prices[0]!.amountMinor).toBe('1999');
  });
  it.each([
    'amountMinor',
    'currency',
    'tenantId',
    'provider',
    'accountId',
    'environment',
    'returnUrl',
  ])('rejects client-controlled authority %s', (field) => {
    expect(
      checkoutRequestSchema.safeParse({
        priceId: planVersionId,
        mode: 'manual',
        [field]: 'tampered',
      }).success,
    ).toBe(false);
  });
  it('accepts only price identity and mode for checkout', () => {
    expect(
      checkoutRequestSchema.parse({
        priceId: planVersionId,
        mode: 'automatic',
      }),
    ).toEqual({ priceId: planVersionId, mode: 'automatic' });
    expect(
      trialRequestSchema.safeParse({ planVersionId, trialDays: 99 }).success,
    ).toBe(false);
  });
  it('requires BI for statistics and permits a zero-seat capacity without deleting existing users', () => {
    const value = plan();
    value.features.business_intelligence = false;
    expect(planVersionDraftSchema.safeParse(value).success).toBe(false);
    value.features.business_intelligence = true;
    value.quotas.active_users = 0;
    expect(planVersionDraftSchema.safeParse(value).success).toBe(true);
  });
  it.each(['0', '01', '1.99', '9223372036854775808'])(
    'rejects invalid paid price %s',
    (amountMinor) => {
      const value = plan();
      value.prices[0]!.amountMinor = amountMinor;
      expect(planVersionDraftSchema.safeParse(value).success).toBe(false);
    },
  );
  it('rejects currency mismatch, duplicate prices and repeated modes', () => {
    const wrongCurrency = plan();
    wrongCurrency.prices[0]!.currency = 'ARS';
    expect(planVersionDraftSchema.safeParse(wrongCurrency).success).toBe(false);
    const duplicate = plan();
    duplicate.prices.push({ ...duplicate.prices[0]! });
    expect(planVersionDraftSchema.safeParse(duplicate).success).toBe(false);
    const modes = plan();
    modes.prices[0]!.modes = ['manual', 'manual'];
    expect(planVersionDraftSchema.safeParse(modes).success).toBe(false);
  });
  it('rejects missing, fractional and unknown plan capabilities', () => {
    expect(
      planVersionDraftSchema.safeParse({
        ...plan(),
        features: { ...plan().features, unknown: true },
      }).success,
    ).toBe(false);
    expect(
      planVersionDraftSchema.safeParse({
        ...plan(),
        quotas: { ...plan().quotas, active_users: 1.5 },
      }).success,
    ).toBe(false);
    expect(
      planVersionDraftSchema.safeParse({ ...plan(), trialDays: -1 }).success,
    ).toBe(false);
  });
  it.each(['', 'bad key', 'a'.repeat(129)])(
    'rejects invalid operation keys',
    (key) => {
      expect(idempotencyKeySchema.safeParse(key).success).toBe(false);
    },
  );
});
