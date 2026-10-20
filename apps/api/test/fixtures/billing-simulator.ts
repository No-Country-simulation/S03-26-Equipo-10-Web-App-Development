// Test-only in-memory simulation. tsconfig.build.json excludes test/**.
// It models local coordination, NOT remote provider idempotency guarantees.
import type {
  BillingProvider,
  PaymentExpectation,
  PaymentObservation,
} from '../../src/modules/billing/domain/billing.types';
import type {
  HostedCheckout,
  HostedCheckoutPort,
  HostedCheckoutRequest,
  PaymentQueryPort,
} from '../../src/modules/billing/ports/billing-provider.port';
import { moneyToWire } from '../../src/modules/billing/domain/money';

export class SimulationClock {
  constructor(private value: Date) {
    this.set(value);
  }
  now(): Date {
    return new Date(this.value);
  }
  set(value: Date): void {
    if (!Number.isFinite(value.getTime()))
      throw new Error('SIMULATION_CLOCK_INVALID');
    this.value = new Date(value);
  }
}

export class BillingProviderSimulator
  implements HostedCheckoutPort, PaymentQueryPort
{
  private readonly operations = new Map<
    string,
    { fingerprint: string; checkout: HostedCheckout }
  >();
  private readonly payments = new Map<string, PaymentObservation>();
  private sequence = 0;
  private loseResponse = false;

  constructor(
    readonly provider: BillingProvider,
    readonly accountId: string,
  ) {}
  get createdCheckouts(): number {
    return this.operations.size;
  }
  loseNextCreationResponse(): void {
    this.loseResponse = true;
  }

  private fingerprint(request: HostedCheckoutRequest): string {
    const expected = request.expected;
    if (
      expected.provider !== this.provider ||
      expected.accountId !== this.accountId ||
      expected.environment !== 'sandbox'
    ) {
      throw new Error('SIMULATION_SCOPE_MISMATCH');
    }
    return JSON.stringify([
      expected.tenantId,
      expected.obligationId,
      expected.externalReference,
      expected.provider,
      expected.accountId,
      expected.environment,
      moneyToWire(expected.money),
      request.mode,
      request.interval,
    ]);
  }

  async createCheckout(
    request: HostedCheckoutRequest,
  ): Promise<HostedCheckout> {
    const fingerprint = this.fingerprint(request);
    const existing = this.operations.get(request.operationId);
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new Error('SIMULATION_IDEMPOTENCY_CONFLICT');
      return structuredClone(existing.checkout);
    }
    const checkoutId = `simulated-${this.provider}-${++this.sequence}`;
    const checkout = {
      operationId: request.operationId,
      checkoutId,
      redirectUrl: `https://billing-simulator.invalid/${checkoutId}`,
    };
    this.operations.set(request.operationId, { fingerprint, checkout });
    this.payments.set(
      checkoutId,
      structuredClone({
        ...request.expected,
        paymentId: checkoutId,
        status: 'pending',
        refundedMinor: 0n,
        chargedBack: false,
      }),
    );
    if (this.loseResponse) {
      this.loseResponse = false;
      throw new Error('SIMULATION_RESPONSE_LOST_AFTER_CREATION');
    }
    return structuredClone(checkout);
  }

  async findCheckout(
    request: HostedCheckoutRequest,
  ): Promise<HostedCheckout | null> {
    const fingerprint = this.fingerprint(request);
    const existing = this.operations.get(request.operationId);
    if (!existing) return null;
    if (existing.fingerprint !== fingerprint)
      throw new Error('SIMULATION_IDEMPOTENCY_CONFLICT');
    return structuredClone(existing.checkout);
  }

  setPayment(
    paymentId: string,
    status: PaymentObservation['status'],
    refundedMinor = 0n,
    chargedBack = false,
  ): void {
    const payment = this.payments.get(paymentId);
    if (!payment) throw new Error('SIMULATION_PAYMENT_NOT_FOUND');
    this.payments.set(paymentId, {
      ...payment,
      status,
      refundedMinor,
      chargedBack,
    });
  }

  async queryPayment(
    expected: PaymentExpectation,
    paymentId: string,
  ): Promise<PaymentObservation | null> {
    const payment = this.payments.get(paymentId);
    if (!payment) return null;
    if (
      expected.tenantId !== payment.tenantId ||
      expected.provider !== payment.provider ||
      expected.accountId !== payment.accountId ||
      expected.environment !== payment.environment ||
      expected.obligationId !== payment.obligationId
    )
      throw new Error('SIMULATION_SCOPE_MISMATCH');
    return structuredClone(payment);
  }
}
