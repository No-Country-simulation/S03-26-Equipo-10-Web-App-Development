export type BillingProvider = 'stripe' | 'mercadopago';
export type BillingEnvironment = 'sandbox' | 'live';
export type BillingCurrency = 'ARS' | 'USD';
export type BillingInterval = 'month' | 'year';
export type BillingMode = 'manual' | 'automatic';

export interface Money {
  readonly amountMinor: bigint;
  readonly currency: BillingCurrency;
}

export const BILLING_FEATURES = [
  'media',
  'analytics',
  'scoring',
  'business_intelligence',
  'bi_statistics',
  'api_keys',
  'webhooks',
] as const;
export type BillingFeature = (typeof BILLING_FEATURES)[number];
export const BILLING_QUOTAS = [
  'active_users',
  'stored_testimonials',
  'active_api_keys',
  'active_webhooks',
] as const;
export type BillingQuota = (typeof BILLING_QUOTAS)[number];
export type PlanFeatures = Readonly<Record<BillingFeature, boolean>>;
export type PlanQuotas = Readonly<Record<BillingQuota, number | null>>;

export interface AccessPeriod {
  readonly kind: 'trial' | 'paid';
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly revoked: boolean;
}
export type AccessMode =
  | 'unrestricted'
  | 'trial'
  | 'paid'
  | 'grace'
  | 'read_only';

export interface PaymentExpectation {
  readonly tenantId: string;
  readonly obligationId: string;
  readonly externalReference: string;
  readonly provider: BillingProvider;
  readonly accountId: string;
  readonly environment: BillingEnvironment;
  readonly money: Money;
}

// Only an adapter's authenticated, current resource query may produce this input.
// Event payloads and browser parameters are not financial observations.
export interface PaymentObservation extends PaymentExpectation {
  readonly paymentId: string;
  readonly status: 'pending' | 'failed' | 'canceled' | 'succeeded';
  readonly refundedMinor: bigint;
  readonly chargedBack: boolean;
}
export type PaymentStatus =
  | PaymentObservation['status']
  | 'partially_refunded'
  | 'refunded'
  | 'charged_back';
export interface RecordedPayment {
  readonly paymentId: string;
  readonly status: PaymentStatus;
  readonly refundedMinor: bigint;
}
export interface ObligationSettlement {
  readonly expected: PaymentExpectation;
  readonly payments: readonly RecordedPayment[];
  readonly creditedPaymentId: string | null;
}
export interface SettlementResult {
  readonly settlement: ObligationSettlement;
  readonly accessEffect: 'grant' | 'revoke' | 'none';
  readonly discrepancy: 'additional_payment' | null;
}

export class BillingRuleError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'BillingRuleError';
  }
}
