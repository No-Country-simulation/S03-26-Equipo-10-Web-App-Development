import { Test } from '@nestjs/testing';
import { BillingModule } from '../src/modules/billing/billing.module';
import { BILLING_CONFIG } from '../src/modules/billing/integrations/billing.config';
import { PrismaService } from '../src/modules/database/prisma.service';
import { BillingGateways } from '../src/modules/billing/services/billing-gateways.service';
import { createHmac, randomUUID } from 'node:crypto';
import Stripe from 'stripe';
import { readBillingConfig } from '../src/modules/billing/integrations/billing.config';
import type { ProviderSettings } from '../src/modules/billing/integrations/billing.config';
import {
  stripeReceipt,
  mercadoPagoReceipt,
} from '../src/modules/billing/integrations/webhook-authentication';
import {
  mpAmount,
  mpMoney,
  stripeAmount,
} from '../src/modules/billing/integrations/provider-values';
import { StripeGateway } from '../src/modules/billing/integrations/stripe.gateway';
import { MercadoPagoGateway } from '../src/modules/billing/integrations/mercadopago.gateway';
import { SimulationGateway } from '../src/modules/billing/integrations/simulation.gateway';
import type { CheckoutCommand } from '../src/modules/billing/ports/financial-gateway.port';

const secret = 'synthetic-webhook-secret-never-a-credential';
const settings: ProviderSettings = {
  accountId: randomUUID(),
  sellerId: 'acct_synthetic',
  credential: 'sk_test_synthetic',
  webhookSecrets: [secret],
  resourceLiveMode: false,
};
const command = (): CheckoutCommand => ({
  operationId: randomUUID(),
  reference: randomUUID(),
  tenantId: randomUUID(),
  subscriptionId: randomUUID(),
  money: { amountMinor: 1999n, currency: 'USD' },
  interval: 'month',
  mode: 'manual',
  externalPriceId: null,
  title: 'Synthetic plan',
});
const mpInput = (
  id: string,
  ts = String(Math.floor(Date.now() / 1000)),
  requestId = 'synthetic-request',
) => ({
  dataId: id,
  requestId,
  signature: `ts=${ts},v1=${createHmac('sha256', secret).update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`).digest('hex')}`,
  body: { id: 1, type: 'payment', data: { id } },
});

describe('financial provider contracts, authentication and isolation', () => {
  test('disabled requires no secrets; live and production simulation cannot compose', () => {
    expect(readBillingConfig({})).toEqual({ mode: 'disabled' });
    expect(() => readBillingConfig({ BILLING_MODE: 'live' })).toThrow(
      'BILLING_CONFIGURATION_INVALID',
    );
    expect(() =>
      readBillingConfig({ BILLING_MODE: 'sandbox', BILLING_CONFIG_JSON: '{}' }),
    ).toThrow();
    expect(() =>
      readBillingConfig({
        NODE_ENV: 'production',
        BILLING_MODE: 'simulation',
        BILLING_CONFIG_JSON: JSON.stringify({
          simulationKey: 's'.repeat(32),
          returnUrl: 'http://localhost:3000/admin/billing/return',
        }),
      }),
    ).toThrow('BILLING_SIMULATION_FORBIDDEN');
  });
  test('disabled Nest composition starts with no billing database access or remote gateway', async () => {
    const query = jest.fn(() => {
      throw Error('disabled database access');
    });
    const module = await Test.createTestingModule({ imports: [BillingModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: query, $executeRaw: query })
      .overrideProvider(BILLING_CONFIG)
      .useValue({ mode: 'disabled' })
      .compile();
    await module.init();
    await expect(module.get(BillingGateways).get(randomUUID())).rejects.toThrow(
      'BILLING_DISABLED',
    );
    expect(query).not.toHaveBeenCalled();
    await module.close();
  });
  test('configured Stripe sandbox cannot accept live objects', () => {
    expect(() =>
      readBillingConfig({
        BILLING_MODE: 'sandbox',
        BILLING_CONFIG_JSON: JSON.stringify({
          returnUrl: 'https://example.invalid/return',
          notificationUrl: 'https://example.invalid/notify',
          stripe: { ...settings, resourceLiveMode: true },
        }),
      }),
    ).toThrow('BILLING_LIVE_DISABLED');
  });
  test.each([1n, 10n, 29n, 1999n, 999999999999n])(
    'MP numeric boundary roundtrips %s without rounding',
    (amountMinor) => {
      expect(
        mpMoney(mpAmount({ amountMinor, currency: 'ARS' })).amountMinor,
      ).toBe(amountMinor);
    },
  );
  test('unsafe or provider-unsupported money never reaches an SDK', () => {
    expect(() =>
      mpAmount({ amountMinor: 9007199254740993n, currency: 'ARS' }),
    ).toThrow();
    expect(() => mpMoney(1.005)).toThrow();
    expect(() => stripeAmount(100000000n)).toThrow();
  });
  test('Stripe verifies exact bytes, rotation, timestamp, environment and event identity', () => {
    const sdk = new Stripe('sk_test_synthetic');
    const payload = JSON.stringify({
      id: 'evt_synthetic',
      type: 'payment_intent.succeeded',
      livemode: false,
      data: { object: { id: 'pi_synthetic' } },
    });
    const signature = sdk.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
    expect(
      stripeReceipt(Buffer.from(payload), signature, {
        ...settings,
        webhookSecrets: ['rotated-synthetic-secret', secret],
      }),
    ).toEqual({
      eventKey: 'evt_synthetic',
      topic: 'payment_intent.succeeded',
      resourceId: 'pi_synthetic',
    });
    expect(() =>
      stripeReceipt(Buffer.from(payload + ' '), signature, settings),
    ).toThrow('BILLING_SIGNATURE_INVALID');
    expect(() =>
      stripeReceipt(Buffer.from(payload), signature, {
        ...settings,
        resourceLiveMode: true,
      }),
    ).toThrow();
    expect(() =>
      stripeReceipt(
        Buffer.from(payload),
        sdk.webhooks.generateTestHeaderString({
          payload,
          secret,
          timestamp: 1,
        }),
        settings,
      ),
    ).toThrow();
  });
  test.each([10, 13])(
    'MP authenticates %i-digit timestamps with the official SDK',
    (length) => {
      const ts = String(
        length === 13 ? Date.now() : Math.floor(Date.now() / 1000),
      );
      const receipt = mercadoPagoReceipt(mpInput('ABC123', ts), settings, 900);
      expect(receipt.resourceId).toBe('abc123');
      expect(receipt.topic).toBe('payment');
    },
  );
  test('MP rejects changed resource, signature, body mismatch and stale timestamp', () => {
    const input = mpInput('12345');
    expect(() =>
      mercadoPagoReceipt({ ...input, dataId: '12346' }, settings, 900),
    ).toThrow();
    expect(() =>
      mercadoPagoReceipt(
        { ...input, body: { type: 'payment', data: { id: 'other' } } },
        settings,
        900,
      ),
    ).toThrow();
    expect(() =>
      mercadoPagoReceipt(mpInput('12345', '1704908010'), settings, 900),
    ).toThrow();
    expect(() =>
      mercadoPagoReceipt({ ...input, signature: '' }, settings, 900),
    ).toThrow();
  });
  test('MP deduplicates authenticated delivery but permits later updates to same payment', () => {
    const input = mpInput('12345');
    const first = mercadoPagoReceipt(input, settings, 900);
    expect(
      mercadoPagoReceipt(
        { ...input, body: { ...input.body, id: 99 } },
        settings,
        900,
      ).eventKey,
    ).toBe(first.eventKey);
    expect(
      mercadoPagoReceipt(
        mpInput('12345', undefined, 'later-request'),
        settings,
        900,
      ).eventKey,
    ).not.toBe(first.eventKey);
  });
  test('Stripe checkout uses server money and persistent operation key, allows automatic methods', async () => {
    const c = command();
    const gateway = new StripeGateway(
      settings,
      'https://example.invalid/return',
    );
    const create = jest
      .spyOn(gateway.sdk.checkout.sessions, 'create')
      .mockResolvedValue({
        id: 'cs_synthetic',
        livemode: false,
        client_reference_id: c.reference,
        metadata: { cms_operation: c.operationId, cms_tenant: c.tenantId },
        amount_total: 1999,
        currency: 'usd',
        url: 'https://checkout.stripe.com/synthetic',
      } as any);
    await gateway.createCheckout(c);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'usd',
              unit_amount: 1999,
              product_data: { name: c.title },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: expect.any(Object),
      }),
      { idempotencyKey: c.operationId },
    );
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty(
      'payment_method_types',
    );
  });
  test('MP manual and recurring flows use different official products, no card handling', async () => {
    const gateway = new MercadoPagoGateway(
      { ...settings, sellerId: '123' },
      'https://example.invalid/return',
      'https://example.invalid/notify',
    );
    const c = {
      ...command(),
      money: { amountMinor: 1999n, currency: 'ARS' as const },
    };
    const pref = jest.spyOn(gateway.preference, 'create').mockResolvedValue({
      id: 'pref_synthetic',
      collector_id: 123,
      external_reference: c.reference,
      init_point: 'https://www.mercadopago.com.ar/checkout',
      sandbox_init_point: 'https://sandbox.mercadopago.com.ar/checkout',
      items: [{ quantity: 1, currency_id: 'ARS', unit_price: 19.99 }],
    } as any);
    await gateway.createCheckout(c);
    expect(pref.mock.calls[0]?.[0].body.items[0]?.unit_price).toBe(19.99);
    const recurring = jest
      .spyOn(gateway.preapproval, 'create')
      .mockResolvedValue({
        id: 'pre_synthetic',
        collector_id: 123,
        external_reference: c.reference,
        status: 'pending',
        date_created: new Date().toISOString(),
        init_point: 'https://www.mercadopago.com.ar/subscriptions/checkout',
        auto_recurring: {
          frequency: 12,
          frequency_type: 'months',
          transaction_amount: 19.99,
          currency_id: 'ARS',
        },
      } as any);
    await gateway.createCheckout({
      ...c,
      mode: 'automatic',
      interval: 'year',
      payerEmail: 'synthetic@example.invalid',
    });
    expect(recurring).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          status: 'pending',
          payer_email: 'synthetic@example.invalid',
          auto_recurring: {
            frequency: 12,
            frequency_type: 'months',
            transaction_amount: 19.99,
            currency_id: 'ARS',
          },
        }),
      }),
    );
    expect(recurring.mock.calls[0]?.[0].body).not.toHaveProperty(
      'card_token_id',
    );
  });
  test('MP sandbox requires the configured Argentina test seller', async () => {
    const gateway = new MercadoPagoGateway(
      { ...settings, sellerId: '123' },
      'https://example.invalid/return',
      'https://example.invalid/notify',
    );
    jest
      .spyOn(gateway.user, 'get')
      .mockResolvedValue({ id: 123, site_id: 'MLA', tags: [] } as any);
    await expect(gateway.assertAccount()).rejects.toThrow(
      'BILLING_PROVIDER_MISMATCH',
    );
  });
  test('durable simulation survives replacement of gateway and rejects forged state', async () => {
    const c = { ...command(), mode: 'automatic' as const };
    const gateway = new SimulationGateway(
      'synthetic-simulation-key',
      'http://localhost:3000/return',
    );
    const token = gateway.observation(
      c,
      'approved',
      new Date('2026-01-31T00:00:00Z'),
    );
    const restarted = new SimulationGateway(
      'synthetic-simulation-key',
      'http://localhost:3000/return',
    );
    const result = await restarted.read('simulation', token);
    expect(result.payments[0]?.period?.endsAt.toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
    await expect(restarted.read('simulation', token + 'x')).rejects.toThrow();
  });
  test('MP records pending disputes but revokes only a confirmed loss from coverage_applied', async () => {
    const c = command();
    const gateway = new MercadoPagoGateway(
      { ...settings, sellerId: '123' },
      'https://example.invalid/return',
      'https://example.invalid/notify',
    );
    jest.spyOn(gateway.user, 'get').mockResolvedValue({
      id: 123,
      site_id: 'MLA',
      tags: ['test_user'],
    } as any);
    jest.spyOn(gateway.invoice, 'search').mockResolvedValue({ results: [] });
    jest.spyOn(gateway.payment, 'get').mockResolvedValue({
      id: 456,
      collector_id: 123,
      live_mode: false,
      currency_id: 'ARS',
      external_reference: c.reference,
      transaction_amount: '19.99',
      transaction_amount_refunded: 0,
      status: 'charged_back',
      date_created: '2026-10-20T00:00:00Z',
    } as any);
    jest.spyOn(gateway.refunds, 'list').mockResolvedValue([]);
    const cb = {
      id: '234000062890459000',
      payments: [456],
      currency: 'ARS',
      amount: '19.99',
      coverage_applied: null,
      documentation_status: 'review_pending',
      live_mode: false,
    };
    const fetcher = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ results: [cb] }), { status: 200 }),
      );
    try {
      const pending = await gateway.read('payment', '456');
      expect(pending.payments[0]?.chargedBack).toBe(false);
      expect(pending.payments[0]?.adjustments[0]?.status).toBe('pending');
      fetcher.mockResolvedValue(
        new Response(
          JSON.stringify({ results: [{ ...cb, coverage_applied: false }] }),
          { status: 200 },
        ),
      );
      expect(
        (await gateway.read('payment', '456')).payments[0]?.chargedBack,
      ).toBe(true);
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining(
          'https://api.mercadopago.com/v1/chargebacks/search?payment_id=456',
        ),
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Caller-Id': '123' }),
          redirect: 'error',
        }),
      );
    } finally {
      fetcher.mockRestore();
    }
  });
  test('Stripe invoices carry the native cycle, contracted price and verified subscription identity', async () => {
    const c = command();
    const gateway = new StripeGateway(
      settings,
      'https://example.invalid/return',
    );
    const iterator = (items: unknown[]) => ({
      async *[Symbol.asyncIterator]() {
        yield* items;
      },
    });
    jest
      .spyOn(gateway.sdk.accounts, 'retrieve')
      .mockResolvedValue({ id: settings.sellerId } as any);
    jest.spyOn(gateway.sdk.invoices, 'retrieve').mockResolvedValue({
      id: 'in_cycle',
      livemode: false,
      currency: 'usd',
      total: 1999,
      billing_reason: 'subscription_cycle',
      status_transitions: { paid_at: 1769904000 },
      parent: { subscription_details: { subscription: 'sub_external' } },
    } as any);
    jest.spyOn(gateway.sdk.subscriptions, 'retrieve').mockResolvedValue({
      id: 'sub_external',
      livemode: false,
      metadata: {
        cms_reference: c.reference,
        cms_tenant: c.tenantId,
        cms_subscription: c.subscriptionId,
      },
    } as any);
    jest.spyOn(gateway.sdk.invoices, 'listLineItems').mockReturnValue(
      iterator([
        {
          amount: 1999,
          currency: 'usd',
          pricing: { price_details: { price: 'price_contract' } },
          period: { start: 1769904000, end: 1772323200 },
        },
      ]) as any,
    );
    jest.spyOn(gateway.sdk.prices, 'retrieve').mockResolvedValue({
      id: 'price_contract',
      livemode: false,
      currency: 'usd',
      unit_amount: 1999,
      recurring: { interval: 'month', interval_count: 1 },
    } as any);
    jest
      .spyOn(gateway.sdk.invoicePayments, 'list')
      .mockReturnValue(
        iterator([
          { payment: { payment_intent: 'pi_cycle' }, status: 'paid' },
        ]) as any,
      );
    jest.spyOn(gateway.sdk.paymentIntents, 'retrieve').mockResolvedValue({
      id: 'pi_cycle',
      livemode: false,
      currency: 'usd',
      amount: 1999,
      status: 'succeeded',
      created: 1769904000,
      metadata: {},
      latest_charge: 'ch_cycle',
    } as any);
    jest.spyOn(gateway.sdk.charges, 'retrieve').mockResolvedValue({
      id: 'ch_cycle',
      livemode: false,
      payment_intent: 'pi_cycle',
      amount: 1999,
      amount_refunded: 0,
      disputed: false,
      created: 1769904000,
    } as any);
    jest
      .spyOn(gateway.sdk.refunds, 'list')
      .mockReturnValue(iterator([]) as any);
    const snapshot = await gateway.read('invoice.paid', 'in_cycle');
    expect(snapshot.payments[0]).toMatchObject({
      id: 'pi_cycle',
      reference: c.reference,
      cycleId: 'in_cycle',
      tenantId: c.tenantId,
      localSubscriptionId: c.subscriptionId,
      externalPriceId: 'price_contract',
      interval: 'month',
      subscriptionId: 'sub_external',
      money: { amountMinor: 1999n, currency: 'USD' },
    });
    expect(snapshot.payments[0]?.period?.endsAt.getTime()).toBe(1772323200000);
  });
  test('Stripe failed intent is confirmed by API state, and manual access does not start at an old intent creation time', async () => {
    const c = command();
    const gateway = new StripeGateway(
      settings,
      'https://example.invalid/return',
    );
    jest
      .spyOn(gateway.sdk.accounts, 'retrieve')
      .mockResolvedValue({ id: settings.sellerId } as any);
    jest
      .spyOn(gateway.sdk.invoicePayments, 'list')
      .mockResolvedValue({ data: [] } as any);
    const pi = jest
      .spyOn(gateway.sdk.paymentIntents, 'retrieve')
      .mockResolvedValue({
        id: 'pi_failed',
        livemode: false,
        currency: 'usd',
        amount: 1999,
        status: 'requires_payment_method',
        last_payment_error: { code: 'card_declined' },
        created: 1,
        latest_charge: null,
        metadata: {
          cms_reference: c.reference,
          cms_tenant: c.tenantId,
          cms_subscription: c.subscriptionId,
        },
      } as any);
    expect(
      (await gateway.read('payment_intent.payment_failed', 'pi_failed'))
        .payments[0]?.status,
    ).toBe('failed');
    const before = Date.now();
    pi.mockResolvedValue({
      id: 'pi_late',
      livemode: false,
      currency: 'usd',
      amount: 1999,
      status: 'succeeded',
      created: 1,
      latest_charge: null,
      metadata: {
        cms_reference: c.reference,
        cms_tenant: c.tenantId,
        cms_subscription: c.subscriptionId,
      },
    } as any);
    expect(
      (
        await gateway.read('payment_intent.succeeded', 'pi_late')
      ).payments[0]!.paidAt.getTime(),
    ).toBeGreaterThanOrEqual(before);
  });
  test('completed Stripe checkout remains discoverable after its redirect URL is removed', async () => {
    const c = command();
    const gateway = new StripeGateway(
      settings,
      'https://example.invalid/return',
    );
    jest.spyOn(gateway.sdk.checkout.sessions, 'retrieve').mockResolvedValue({
      id: 'cs_completed',
      livemode: false,
      client_reference_id: c.reference,
      metadata: { cms_operation: c.operationId, cms_tenant: c.tenantId },
      amount_total: 1999,
      currency: 'usd',
      url: null,
    } as any);
    expect(await gateway.findCheckout(c, 'cs_completed')).toEqual({
      id: 'cs_completed',
      url: null,
    });
  });
});
