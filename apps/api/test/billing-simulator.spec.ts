import {
  BillingProviderSimulator,
  SimulationClock,
} from './fixtures/billing-simulator';
import { applyPaymentObservation } from '../src/modules/billing/domain/settlement';
import {
  evaluateAccess,
  startTrial,
} from '../src/modules/billing/domain/access-policy';
import type { HostedCheckoutRequest } from '../src/modules/billing/ports/billing-provider.port';
import type {
  BillingProvider,
  PaymentExpectation,
} from '../src/modules/billing/domain/billing.types';

const expectation = (provider: BillingProvider): PaymentExpectation => ({
  tenantId: 'synthetic-tenant-a',
  obligationId: 'synthetic-obligation-a',
  externalReference: 'synthetic-order-a',
  provider,
  accountId: 'synthetic-seller',
  environment: 'sandbox',
  money: {
    amountMinor: 2500n,
    currency: provider === 'stripe' ? 'USD' : 'ARS',
  },
});

describe.each(['stripe', 'mercadopago'] as const)(
  '%s port simulation (no network or SDK)',
  (provider) => {
    const request = (): HostedCheckoutRequest => ({
      operationId: 'synthetic-operation',
      expected: expectation(provider),
      mode: 'automatic',
      interval: 'month',
    });
    it('recovers a lost creation response by lookup, then grants exactly once after querying payment', async () => {
      const simulator = new BillingProviderSimulator(
        provider,
        'synthetic-seller',
      );
      simulator.loseNextCreationResponse();
      await expect(simulator.createCheckout(request())).rejects.toThrow(
        'SIMULATION_RESPONSE_LOST_AFTER_CREATION',
      );
      const checkout = await simulator.findCheckout(request());
      expect(checkout).not.toBeNull();
      expect(simulator.createdCheckouts).toBe(1);
      const initial = {
        expected: request().expected,
        payments: [],
        creditedPaymentId: null,
      };
      const pending = await simulator.queryPayment(
        request().expected,
        checkout!.checkoutId,
      );
      expect(applyPaymentObservation(initial, pending!).accessEffect).toBe(
        'none',
      );
      simulator.setPayment(checkout!.checkoutId, 'succeeded');
      const approved = await simulator.queryPayment(
        request().expected,
        checkout!.checkoutId,
      );
      const settled = applyPaymentObservation(initial, approved!);
      expect(settled.accessEffect).toBe('grant');
      expect(
        applyPaymentObservation(settled.settlement, approved!).accessEffect,
      ).toBe('none');
      expect(simulator.createdCheckouts).toBe(1);
    });
    it('coordinates concurrent local replays and rejects payload changes under the same operation', async () => {
      const simulator = new BillingProviderSimulator(
        provider,
        'synthetic-seller',
      );
      const [a, b] = await Promise.all([
        simulator.createCheckout(request()),
        simulator.createCheckout(request()),
      ]);
      expect(a.checkoutId).toBe(b.checkoutId);
      expect(simulator.createdCheckouts).toBe(1);
      await expect(
        simulator.createCheckout({ ...request(), mode: 'manual' }),
      ).rejects.toThrow('SIMULATION_IDEMPOTENCY_CONFLICT');
    });
    it('does not leak state across tenants, environments or returned object mutation', async () => {
      const simulator = new BillingProviderSimulator(
        provider,
        'synthetic-seller',
      );
      const checkout = await simulator.createCheckout(request());
      const other = { ...request().expected, tenantId: 'synthetic-tenant-b' };
      await expect(
        simulator.queryPayment(other, checkout.checkoutId),
      ).rejects.toThrow('SIMULATION_SCOPE_MISMATCH');
      await expect(
        simulator.findCheckout({ ...request(), expected: other }),
      ).rejects.toThrow('SIMULATION_IDEMPOTENCY_CONFLICT');
      await expect(
        simulator.createCheckout({
          ...request(),
          expected: { ...request().expected, environment: 'live' },
        }),
      ).rejects.toThrow('SIMULATION_SCOPE_MISMATCH');
      Object.assign(checkout, { redirectUrl: 'https://mutated.invalid/' });
      expect((await simulator.findCheckout(request()))!.redirectUrl).toMatch(
        /^https:\/\/billing-simulator\.invalid\//,
      );
    });
  },
);

it('advances trial/paid/grace/read-only deterministically without changing global clocks', () => {
  const clock = new SimulationClock(new Date('2026-10-01T12:00:00Z'));
  const trial = startTrial({
    now: clock.now(),
    days: 14,
    alreadyConsumed: false,
    hasPaidCoverage: false,
  });
  clock.set(new Date('2026-10-15T12:00:00Z'));
  expect(
    evaluateAccess({
      enabled: true,
      now: clock.now(),
      periods: [trial],
      graceDays: 7,
    }).mode,
  ).toBe('read_only');
  const paid = {
    kind: 'paid' as const,
    startsAt: clock.now(),
    endsAt: new Date('2026-11-15T12:00:00Z'),
    revoked: false,
  };
  expect(
    evaluateAccess({
      enabled: true,
      now: clock.now(),
      periods: [paid],
      graceDays: 7,
    }).mode,
  ).toBe('paid');
  clock.set(paid.endsAt);
  expect(
    evaluateAccess({
      enabled: true,
      now: clock.now(),
      periods: [paid],
      graceDays: 7,
    }).mode,
  ).toBe('grace');
  clock.set(new Date('2026-11-22T12:00:00Z'));
  expect(
    evaluateAccess({
      enabled: true,
      now: clock.now(),
      periods: [paid],
      graceDays: 7,
    }).mode,
  ).toBe('read_only');
});
