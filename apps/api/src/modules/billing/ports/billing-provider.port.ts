import type {
  BillingMode,
  BillingInterval,
  PaymentExpectation,
  PaymentObservation,
} from '../domain/billing.types';

export interface HostedCheckoutRequest {
  readonly operationId: string;
  readonly expected: PaymentExpectation;
  readonly mode: BillingMode;
  readonly interval: BillingInterval;
}
export interface HostedCheckout {
  readonly operationId: string;
  readonly checkoutId: string;
  readonly redirectUrl: string;
}
export interface HostedCheckoutPort {
  createCheckout(request: HostedCheckoutRequest): Promise<HostedCheckout>;
  // null means not found, not proof of safe recreation. The application retains
  // uncertainty until the adapter can establish absence or operator resolution.
  findCheckout(request: HostedCheckoutRequest): Promise<HostedCheckout | null>;
}
export interface PaymentQueryPort {
  queryPayment(
    expected: PaymentExpectation,
    paymentId: string,
  ): Promise<PaymentObservation | null>;
}
export interface SubscriptionCancellationPort {
  stopRenewal(
    subscriptionId: string,
    operationId: string,
  ): Promise<'confirmed' | 'uncertain'>;
}

// No universal signature algorithm or refunds port. Webhook authentication is
// provider-specific and refunds are observed, not initiated, in v1.
