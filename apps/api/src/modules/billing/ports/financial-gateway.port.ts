import type {
  BillingInterval,
  BillingMode,
  Money,
} from '../domain/billing.types';

export interface GatewayCheckout {
  id: string;
  url: string | null;
  subscriptionId?: string;
}
export interface CheckoutCommand {
  operationId: string;
  reference: string;
  tenantId: string;
  subscriptionId: string;
  money: Money;
  interval: BillingInterval;
  mode: BillingMode;
  externalPriceId: string | null;
  title: string;
  knownCheckoutId?: string;
  // Ephemeral: read from authenticated local user, never in durable request_data.
  payerEmail?: string;
}
export interface FinancialAdjustment {
  id: string;
  kind: 'refund' | 'chargeback';
  amountMinor: bigint;
  status: string;
  confirmed: boolean;
}
export interface VerifiedPayment {
  id: string;
  reference: string;
  money: Money;
  status: 'pending' | 'failed' | 'canceled' | 'succeeded';
  providerStatus: string;
  refundedMinor: bigint;
  chargedBack: boolean;
  paidAt: Date;
  tenantId?: string;
  localSubscriptionId?: string;
  externalPriceId?: string;
  interval?: BillingInterval;
  subscriptionId?: string;
  cycleId?: string;
  period?: { startsAt: Date; endsAt: Date };
  adjustments: FinancialAdjustment[];
}
export interface VerifiedSubscription {
  id: string;
  reference: string;
  stopped: boolean;
  payments: VerifiedPayment[];
}
export interface FinancialGateway {
  assertAccount(): Promise<void>;
  syncPrice(command: {
    id: string;
    title: string;
    money: Money;
    interval: BillingInterval;
  }): Promise<{ productId: string | null; priceId: string | null }>;
  createCheckout(command: CheckoutCommand): Promise<GatewayCheckout>;
  findCheckout(
    command: CheckoutCommand,
    knownId?: string,
  ): Promise<GatewayCheckout | null>;
  read(
    topic: string,
    resourceId: string,
  ): Promise<{
    payments: VerifiedPayment[];
    subscription?: VerifiedSubscription;
  }>;
  reconcile(
    command: CheckoutCommand,
    checkoutId?: string,
  ): Promise<{
    payments: VerifiedPayment[];
    subscription?: VerifiedSubscription;
  }>;
  stopRenewal(id: string, operationId: string): Promise<boolean>;
}
export class GatewayError extends Error {
  constructor(
    readonly code: string,
    readonly permanent = false,
    readonly retryAfterMs = 0,
  ) {
    super(code);
  }
}
