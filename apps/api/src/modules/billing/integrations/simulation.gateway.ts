import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type {
  CheckoutCommand,
  FinancialGateway,
  GatewayCheckout,
  VerifiedPayment,
} from '../ports/financial-gateway.port';
import { GatewayError } from '../ports/financial-gateway.port';
import { nextCalendarBoundary } from '../domain/calendar';

const tokenSchema = z.object({
  reference: z.uuid(),
  amount: z.string().regex(/^[1-9]\d*$/),
  currency: z.enum(['ARS', 'USD']),
  scenario: z.enum([
    'pending',
    'approved',
    'rejected',
    'partial_refund',
    'full_refund',
    'chargeback',
  ]),
  at: z.iso.datetime(),
  interval: z.enum(['month', 'year']),
  mode: z.enum(['manual', 'automatic']),
  cycle: z.string().max(50),
});
// Entire simulated external state is signed into the durable inbox resource ID.
// Restarting the API cannot lose or invent a simulated provider response.
export class SimulationGateway implements FinancialGateway {
  constructor(
    private readonly key: string,
    private readonly returnUrl: string,
  ) {}
  async assertAccount() {}
  async syncPrice() {
    return { productId: null, priceId: null };
  }
  async createCheckout(c: CheckoutCommand): Promise<GatewayCheckout> {
    return {
      id: `sim_${c.reference}`,
      url: this.returnUrl,
      ...(c.mode === 'automatic'
        ? { subscriptionId: `simsub_${c.reference}` }
        : {}),
    };
  }
  async findCheckout(c: CheckoutCommand): Promise<GatewayCheckout | null> {
    return this.createCheckout(c);
  }
  observation(
    c: CheckoutCommand,
    scenario: z.infer<typeof tokenSchema>['scenario'],
    at: Date,
    cycle = 'initial',
  ) {
    const data = tokenSchema.parse({
      reference: c.reference,
      amount: c.money.amountMinor.toString(),
      currency: c.money.currency,
      scenario,
      at: at.toISOString(),
      interval: c.interval,
      mode: c.mode,
      cycle,
    });
    const encoded = Buffer.from(JSON.stringify(data)).toString('base64url');
    return `${encoded}.${createHmac('sha256', this.key).update(encoded).digest('base64url')}`;
  }
  async read(topic: string, resourceId: string) {
    if (topic !== 'simulation')
      throw new GatewayError('BILLING_SIMULATION_ONLY', true);
    const [encoded, mac, extra] = resourceId.split('.');
    if (!encoded || !mac || extra)
      throw new GatewayError('BILLING_SIMULATION_INVALID', true);
    const expected = createHmac('sha256', this.key).update(encoded).digest();
    const received = Buffer.from(mac, 'base64url');
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    )
      throw new GatewayError('BILLING_SIMULATION_INVALID', true);
    const data = tokenSchema.parse(
      JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')),
    );
    const amount = BigInt(data.amount);
    const startsAt = new Date(data.at);
    const p: VerifiedPayment = {
      id: `simpay_${data.reference}_${data.cycle}`,
      reference: data.reference,
      money: { amountMinor: amount, currency: data.currency },
      status:
        data.scenario === 'pending'
          ? 'pending'
          : data.scenario === 'rejected'
            ? 'failed'
            : 'succeeded',
      providerStatus: data.scenario,
      refundedMinor:
        data.scenario === 'full_refund'
          ? amount
          : data.scenario === 'partial_refund'
            ? amount / 2n
            : 0n,
      chargedBack: data.scenario === 'chargeback',
      paidAt: startsAt,
      adjustments: [],
      ...(data.mode === 'automatic'
        ? {
            subscriptionId: `simsub_${data.reference}`,
            cycleId: `simcycle_${data.reference}_${data.cycle}`,
            period: {
              startsAt,
              endsAt: nextCalendarBoundary(
                startsAt,
                data.interval,
                startsAt.getUTCDate(),
              ),
            },
          }
        : {}),
    };
    if (p.refundedMinor)
      p.adjustments.push({
        id: `simrefund_${p.id}_partial`,
        kind: 'refund',
        amountMinor: amount / 2n,
        status: 'approved',
        confirmed: true,
      });
    if (data.scenario === 'full_refund')
      p.adjustments.push({
        id: `simrefund_${p.id}_rest`,
        kind: 'refund',
        amountMinor: amount - amount / 2n,
        status: 'approved',
        confirmed: true,
      });
    if (p.chargedBack)
      p.adjustments.push({
        id: `simdispute_${p.id}`,
        kind: 'chargeback',
        amountMinor: amount,
        status: 'lost',
        confirmed: true,
      });
    return { payments: [p] };
  }
  async reconcile() {
    return { payments: [] };
  }
  async stopRenewal() {
    return true;
  }
}
