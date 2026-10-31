import {
  BillingRuleError,
  type ObligationSettlement,
  type PaymentObservation,
  type PaymentStatus,
  type SettlementResult,
} from './billing.types';
import { moneyToWire } from './money';

const givesAccess = (status: PaymentStatus) =>
  status === 'succeeded' || status === 'partially_refunded';

// A pure decision, NOT a durable ledger: repositories must atomically persist
// payment, unique grant/revocation and audit under the obligation lock (phase 2).
export function applyPaymentObservation(
  settlement: ObligationSettlement,
  observation: PaymentObservation,
): SettlementResult {
  const expected = settlement.expected;
  moneyToWire(expected.money);
  moneyToWire(observation.money);
  if (
    observation.tenantId !== expected.tenantId ||
    observation.obligationId !== expected.obligationId ||
    observation.externalReference !== expected.externalReference ||
    observation.provider !== expected.provider ||
    observation.accountId !== expected.accountId ||
    observation.environment !== expected.environment ||
    observation.money.amountMinor !== expected.money.amountMinor ||
    observation.money.currency !== expected.money.currency
  ) {
    throw new BillingRuleError('BILLING_PAYMENT_MISMATCH');
  }
  if (
    !observation.paymentId ||
    expected.money.amountMinor === 0n ||
    typeof observation.refundedMinor !== 'bigint' ||
    observation.refundedMinor < 0n ||
    observation.refundedMinor > expected.money.amountMinor ||
    (observation.status !== 'succeeded' &&
      (observation.refundedMinor > 0n || observation.chargedBack))
  ) {
    throw new BillingRuleError('BILLING_PAYMENT_INVALID');
  }
  const previous = settlement.payments.find(
    (payment) => payment.paymentId === observation.paymentId,
  );
  const refundedMinor =
    previous && previous.refundedMinor > observation.refundedMinor
      ? previous.refundedMinor
      : observation.refundedMinor;
  let status: PaymentStatus = observation.status;
  if (previous && previous.status !== 'pending' && status === 'pending')
    status = previous.status;
  if (previous && givesAccess(previous.status) && status !== 'succeeded')
    status = previous.status;
  if (refundedMinor > 0n)
    status =
      refundedMinor === expected.money.amountMinor
        ? 'refunded'
        : 'partially_refunded';
  if (observation.chargedBack || previous?.status === 'charged_back')
    status = 'charged_back';
  const payment = { paymentId: observation.paymentId, status, refundedMinor };
  const payments = [
    ...settlement.payments.filter((row) => row.paymentId !== payment.paymentId),
    payment,
  ];
  let creditedPaymentId = settlement.creditedPaymentId;
  let accessEffect: SettlementResult['accessEffect'] = 'none';
  if (creditedPaymentId === null && givesAccess(status)) {
    creditedPaymentId = payment.paymentId;
    accessEffect = 'grant';
  } else if (
    creditedPaymentId === payment.paymentId &&
    previous &&
    givesAccess(previous.status) &&
    !givesAccess(status)
  ) {
    accessEffect = 'revoke';
  }
  return {
    settlement: { expected, payments, creditedPaymentId },
    accessEffect,
    discrepancy:
      creditedPaymentId !== null &&
      creditedPaymentId !== payment.paymentId &&
      givesAccess(status)
        ? 'additional_payment'
        : null,
  };
}
