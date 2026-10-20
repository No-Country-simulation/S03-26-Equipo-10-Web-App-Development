import { applyPaymentObservation } from '../src/modules/billing/domain/settlement';
import type {
  ObligationSettlement,
  PaymentExpectation,
  PaymentObservation,
} from '../src/modules/billing/domain/billing.types';

const expected: PaymentExpectation = {
  tenantId: 'tenant-a',
  obligationId: 'obligation-a',
  externalReference: 'order-a',
  provider: 'stripe',
  accountId: 'account-a',
  environment: 'sandbox',
  money: { amountMinor: 1999n, currency: 'USD' },
};
const empty = (): ObligationSettlement => ({
  expected,
  payments: [],
  creditedPaymentId: null,
});
const observation = (
  patch: Partial<PaymentObservation> = {},
): PaymentObservation => ({
  ...expected,
  paymentId: 'payment-a',
  status: 'succeeded',
  refundedMinor: 0n,
  chargedBack: false,
  ...patch,
});

describe('authoritative financial observations', () => {
  it('grants once and does not mutate the input ledger', () => {
    const initial = empty();
    const paid = applyPaymentObservation(initial, observation());
    expect(paid.accessEffect).toBe('grant');
    expect(paid.settlement.creditedPaymentId).toBe('payment-a');
    expect(
      applyPaymentObservation(paid.settlement, observation()).accessEffect,
    ).toBe('none');
    expect(initial.payments).toEqual([]);
  });
  it.each([
    { tenantId: 'tenant-b' },
    { obligationId: 'obligation-b' },
    { externalReference: 'other-order' },
    { provider: 'mercadopago' as const },
    { accountId: 'other-seller' },
    { environment: 'live' as const },
    { money: { amountMinor: 2000n, currency: 'USD' as const } },
    { money: { amountMinor: 1999n, currency: 'ARS' as const } },
  ])('rejects mismatched financial identity %j', (patch) => {
    expect(() => applyPaymentObservation(empty(), observation(patch))).toThrow(
      'BILLING_PAYMENT_MISMATCH',
    );
  });
  it('records a pending or rejected attempt without granting access and allows later success', () => {
    const pending = applyPaymentObservation(
      empty(),
      observation({ status: 'pending' }),
    );
    expect(pending.accessEffect).toBe('none');
    const failed = applyPaymentObservation(
      pending.settlement,
      observation({ status: 'failed' }),
    );
    expect(failed.accessEffect).toBe('none');
    expect(
      applyPaymentObservation(failed.settlement, observation()).accessEffect,
    ).toBe('grant');
  });
  it.each(['pending', 'failed', 'canceled'] as const)(
    'does not degrade a successful payment to %s',
    (status) => {
      const paid = applyPaymentObservation(empty(), observation());
      const late = applyPaymentObservation(
        paid.settlement,
        observation({ status }),
      );
      expect(late.settlement.payments[0]!.status).toBe('succeeded');
      expect(late.accessEffect).toBe('none');
    },
  );
  it('retains a partial refund, revokes only upon full refund, and ignores stale snapshots', () => {
    const paid = applyPaymentObservation(empty(), observation());
    const partial = applyPaymentObservation(
      paid.settlement,
      observation({ refundedMinor: 999n }),
    );
    expect(partial).toMatchObject({
      accessEffect: 'none',
      settlement: {
        payments: [{ status: 'partially_refunded', refundedMinor: 999n }],
      },
    });
    const full = applyPaymentObservation(
      partial.settlement,
      observation({ refundedMinor: 1999n }),
    );
    expect(full.accessEffect).toBe('revoke');
    const stale = applyPaymentObservation(full.settlement, observation());
    expect(stale.accessEffect).toBe('none');
    expect(stale.settlement.payments[0]!.status).toBe('refunded');
  });
  it('does not grant when the first observation is already fully refunded', () => {
    expect(
      applyPaymentObservation(empty(), observation({ refundedMinor: 1999n }))
        .accessEffect,
    ).toBe('none');
  });
  it('revokes a confirmed chargeback and cannot restore it from an older approval', () => {
    const paid = applyPaymentObservation(empty(), observation());
    const chargedBack = applyPaymentObservation(
      paid.settlement,
      observation({ chargedBack: true }),
    );
    expect(chargedBack.accessEffect).toBe('revoke');
    expect(
      applyPaymentObservation(chargedBack.settlement, observation()).settlement
        .payments[0]!.status,
    ).toBe('charged_back');
  });
  it('records an additional payment without granting a second period or stealing the credited payment', () => {
    const paid = applyPaymentObservation(empty(), observation());
    const extra = applyPaymentObservation(
      paid.settlement,
      observation({ paymentId: 'payment-b' }),
    );
    expect(extra.discrepancy).toBe('additional_payment');
    expect(extra.accessEffect).toBe('none');
    expect(extra.settlement.creditedPaymentId).toBe('payment-a');
    expect(extra.settlement.payments).toHaveLength(2);
    expect(
      applyPaymentObservation(
        extra.settlement,
        observation({ paymentId: 'payment-b', refundedMinor: 1999n }),
      ).accessEffect,
    ).toBe('none');
  });
  it.each([-1n, 2000n])(
    'rejects invalid cumulative refund %s',
    (refundedMinor) => {
      expect(() =>
        applyPaymentObservation(empty(), observation({ refundedMinor })),
      ).toThrow('BILLING_PAYMENT_INVALID');
    },
  );
  it('rejects contradictory unsettled refunds', () => {
    expect(() =>
      applyPaymentObservation(
        empty(),
        observation({ status: 'pending', refundedMinor: 1n }),
      ),
    ).toThrow('BILLING_PAYMENT_INVALID');
  });
});
