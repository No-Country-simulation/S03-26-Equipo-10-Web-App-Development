import { billingReturnUrl } from './provider-values';
import {
  MercadoPagoConfig,
  Payment,
  Preference,
  PreApproval,
  Invoice,
  User,
  PaymentRefund,
} from 'mercadopago';
import { z } from 'zod';
import type { ProviderSettings } from './billing.config';
import type {
  CheckoutCommand,
  FinancialGateway,
  GatewayCheckout,
  VerifiedPayment,
  VerifiedSubscription,
} from '../ports/financial-gateway.port';
import { GatewayError } from '../ports/financial-gateway.port';
import {
  checkoutUrl,
  idValue,
  instant,
  mpAmount,
  mpMoney,
  referenceValue,
  requireMatch,
} from './provider-values';
import { nextCalendarBoundary } from '../domain/calendar';

const decimal = z.union([
  z.number(),
  z
    .string()
    .max(20)
    .refine((value) => {
      try {
        mpMoney(value);
        return true;
      } catch {
        return false;
      }
    }),
]);
const chargebackSchema = z.object({
  id: idValue,
  payments: z.array(idValue).min(1),
  currency: z.literal('ARS'),
  amount: decimal,
  coverage_applied: z.boolean().nullable(),
  documentation_status: z.string(),
  live_mode: z.boolean(),
});
const subscriptionSchema = z.object({
  id: idValue,
  collector_id: idValue,
  application_id: idValue.optional(),
  external_reference: referenceValue,
  status: z.string(),
  init_point: z.string().optional(),
  date_created: instant,
  auto_recurring: z.object({
    frequency: z.number().int(),
    frequency_type: z.string(),
    transaction_amount: decimal,
    currency_id: z.literal('ARS'),
    start_date: instant.optional(),
  }),
});
const paymentSchema = z.object({
  id: idValue,
  collector_id: idValue,
  live_mode: z.boolean(),
  currency_id: z.literal('ARS'),
  external_reference: z.string().nullable().optional(),
  transaction_amount: decimal,
  transaction_amount_refunded: decimal.default(0),
  status: z.string(),
  date_approved: instant.nullable().optional(),
  date_created: instant,
});
export class MercadoPagoGateway implements FinancialGateway {
  readonly payment: Payment;
  readonly preference: Preference;
  readonly preapproval: PreApproval;
  readonly invoice: Invoice;
  readonly user: User;
  readonly refunds: PaymentRefund;
  constructor(
    private readonly settings: ProviderSettings,
    private readonly returnUrl: string,
    private readonly notificationUrl: string,
    config?: MercadoPagoConfig,
  ) {
    const sdk =
      config ??
      new MercadoPagoConfig({
        accessToken: settings.credential,
        options: { timeout: 10000, maxRetries: 0 },
      });
    this.payment = new Payment(sdk);
    this.preference = new Preference(sdk);
    this.preapproval = new PreApproval(sdk);
    this.invoice = new Invoice(sdk);
    this.user = new User(sdk);
    this.refunds = new PaymentRefund(sdk);
  }
  async assertAccount() {
    const me = z
      .object({
        id: idValue,
        site_id: z.literal('MLA'),
        tags: z.array(z.string()),
      })
      .parse(await this.user.get());
    requireMatch(
      me.id === this.settings.sellerId && me.tags.includes('test_user'),
    ); // sandbox composition only
  }
  async syncPrice(c: Parameters<FinancialGateway['syncPrice']>[0]) {
    requireMatch(c.money.currency === 'ARS');
    mpAmount(c.money);
    // No remote plan: pending /preapproval snapshots local immutable terms.
    return { productId: null, priceId: null };
  }
  private sub(value: unknown) {
    const sub = subscriptionSchema.parse(value);
    requireMatch(
      sub.collector_id === this.settings.sellerId &&
        (!this.settings.applicationId ||
          sub.application_id === this.settings.applicationId),
    );
    requireMatch(
      sub.auto_recurring.frequency_type === 'months' &&
        [1, 12].includes(sub.auto_recurring.frequency),
    );
    return sub;
  }
  private hosted(value: unknown, c: CheckoutCommand): GatewayCheckout {
    if (c.mode === 'automatic') {
      const sub = this.sub(value);
      requireMatch(
        sub.external_reference === c.reference &&
          sub.init_point &&
          mpMoney(sub.auto_recurring.transaction_amount).amountMinor ===
            c.money.amountMinor &&
          sub.auto_recurring.frequency === (c.interval === 'month' ? 1 : 12),
      );
      return {
        id: sub.id,
        subscriptionId: sub.id,
        url: checkoutUrl(sub.init_point, ['www.mercadopago.com.ar']),
      };
    }
    const pref = z
      .object({
        id: idValue,
        collector_id: idValue,
        external_reference: referenceValue,
        init_point: z.string(),
        sandbox_init_point: z.string().optional(),
        items: z
          .array(
            z.object({
              quantity: z.literal(1),
              currency_id: z.literal('ARS'),
              unit_price: decimal,
            }),
          )
          .length(1),
      })
      .parse(value);
    requireMatch(
      pref.collector_id === this.settings.sellerId &&
        pref.external_reference === c.reference &&
        mpMoney(pref.items[0]!.unit_price).amountMinor === c.money.amountMinor,
    );
    const url = this.settings.resourceLiveMode
      ? pref.init_point
      : pref.sandbox_init_point;
    requireMatch(url);
    return {
      id: pref.id,
      url: checkoutUrl(url, [
        'www.mercadopago.com.ar',
        'sandbox.mercadopago.com.ar',
      ]),
    };
  }
  async createCheckout(c: CheckoutCommand) {
    requireMatch(c.money.currency === 'ARS');
    const requestOptions = { idempotencyKey: c.operationId, maxRetries: 0 };
    if (c.mode === 'automatic') {
      requireMatch(c.payerEmail);
      const body = {
        reason: c.title,
        external_reference: c.reference,
        payer_email: c.payerEmail,
        auto_recurring: {
          frequency: c.interval === 'month' ? 1 : 12,
          frequency_type: 'months',
          transaction_amount: mpAmount(c.money),
          currency_id: 'ARS',
        },
        back_url: billingReturnUrl(this.returnUrl, c.operationId),
        status: 'pending',
      };
      return this.hosted(
        await this.preapproval.create({ body, requestOptions }),
        c,
      );
    }
    return this.hosted(
      await this.preference.create({
        body: {
          items: [
            {
              id: c.reference,
              title: c.title,
              quantity: 1,
              currency_id: 'ARS',
              unit_price: mpAmount(c.money),
            },
          ],
          external_reference: c.reference,
          notification_url: this.notificationUrl,
          back_urls: {
            success: billingReturnUrl(this.returnUrl, c.operationId),
            pending: billingReturnUrl(this.returnUrl, c.operationId),
            failure: billingReturnUrl(this.returnUrl, c.operationId),
          },
        },
        requestOptions,
      }),
      c,
    );
  }
  async findCheckout(
    c: CheckoutCommand,
    knownId?: string,
  ): Promise<GatewayCheckout | null> {
    if (knownId)
      return this.hosted(
        c.mode === 'automatic'
          ? await this.preapproval.get({ id: knownId })
          : await this.preference.get({ preferenceId: knownId }),
        c,
      );
    const ids: string[] = [];
    for (let offset = 0; offset < 10000; offset += 100) {
      const page =
        c.mode === 'automatic'
          ? await this.preapproval.search({
              options: { external_reference: c.reference, offset, limit: 100 },
            })
          : await this.preference.search({
              options: { external_reference: c.reference, offset, limit: 100 },
            });
      const parsed = z
        .object({
          results: z
            .array(z.object({ id: idValue, external_reference: z.string() }))
            .optional(),
          elements: z
            .array(z.object({ id: idValue, external_reference: z.string() }))
            .optional(),
        })
        .parse(page);
      const entries = parsed.results ?? parsed.elements ?? [];
      ids.push(
        ...entries
          .filter((e) => e.external_reference === c.reference)
          .map((e) => e.id),
      );
      if (entries.length < 100) break;
      if (offset === 9900)
        throw new GatewayError('BILLING_SEARCH_REVIEW', true);
    }
    requireMatch(ids.length <= 1);
    return ids[0] ? this.findCheckout(c, ids[0]) : null;
  }
  private async chargebackGet(path: string): Promise<unknown> {
    // SDK 3.6.1's Chargeback client lacks the currently required X-Caller-Id
    // header and models the legacy response. Keep the exception in this adapter.
    const response = await fetch(
      `https://api.mercadopago.com/v1/chargebacks/${path}`,
      {
        headers: {
          Authorization: `Bearer ${this.settings.credential}`,
          'X-Caller-Id': this.settings.sellerId,
        },
        signal: AbortSignal.timeout(10000),
        redirect: 'error',
      },
    );
    if (!response.ok) {
      const after = response.headers.get('retry-after');
      const delay = after
        ? /^\d+$/.test(after)
          ? Number(after) * 1000
          : Date.parse(after) - Date.now()
        : 0;
      throw new GatewayError(
        'BILLING_PROVIDER_UNAVAILABLE',
        false,
        Number.isFinite(delay) ? Math.max(0, delay) : 0,
      );
    }
    return response.json();
  }
  private async chargebackAdjustments(
    id: string,
  ): Promise<VerifiedPayment['adjustments']> {
    const result: VerifiedPayment['adjustments'] = [];
    for (let offset = 0; offset < 10000; offset += 100) {
      const page = z
        .object({ results: z.array(chargebackSchema) })
        .parse(
          await this.chargebackGet(
            `search?payment_id=${encodeURIComponent(id)}&limit=100&offset=${offset}`,
          ),
        );
      for (const cb of page.results) {
        requireMatch(
          cb.live_mode === this.settings.resourceLiveMode &&
            cb.payments.includes(id),
        );
        result.push({
          id: cb.id,
          kind: 'chargeback',
          amountMinor: mpMoney(cb.amount).amountMinor,
          status:
            cb.coverage_applied === null
              ? 'pending'
              : cb.coverage_applied
                ? 'covered'
                : 'lost',
          confirmed: cb.coverage_applied === false,
        });
      }
      if (page.results.length < 100) return result;
    }
    throw new GatewayError('BILLING_SEARCH_REVIEW', true);
  }
  private async manualPayment(
    id: string,
    reference?: string,
  ): Promise<VerifiedPayment> {
    const p = paymentSchema.parse(await this.payment.get({ id }));
    requireMatch(
      p.collector_id === this.settings.sellerId &&
        p.live_mode === this.settings.resourceLiveMode,
    );
    requireMatch(
      !reference || !p.external_reference || p.external_reference === reference,
    );
    const ref = referenceValue.parse(reference ?? p.external_reference);
    const adjustments = await this.chargebackAdjustments(id);
    const refunds = z
      .array(z.object({ id: idValue, amount: decimal, status: z.string() }))
      .parse(await this.refunds.list({ payment_id: id }));
    for (const refund of refunds)
      adjustments.push({
        id: refund.id,
        kind: 'refund',
        amountMinor: mpMoney(refund.amount).amountMinor,
        status: refund.status,
        confirmed: refund.status === 'approved',
      });
    return {
      id: p.id,
      reference: ref,
      money: mpMoney(p.transaction_amount),
      status: ['approved', 'refunded', 'charged_back'].includes(p.status)
        ? 'succeeded'
        : p.status === 'rejected'
          ? 'failed'
          : p.status === 'cancelled'
            ? 'canceled'
            : 'pending',
      providerStatus: p.status,
      refundedMinor: mpMoney(p.transaction_amount_refunded).amountMinor,
      chargedBack: adjustments.some(
        (a) => a.kind === 'chargeback' && a.confirmed,
      ),
      paidAt: p.date_approved ?? p.date_created,
      adjustments,
    };
  }
  private async invoicePayments(value: unknown): Promise<VerifiedPayment[]> {
    const inv = z
      .object({
        id: idValue,
        preapproval_id: idValue,
        debit_date: instant,
        transaction_amount: decimal,
        currency_id: z.literal('ARS'),
        payment: z.object({ id: idValue }).nullable().optional(),
      })
      .parse(value);
    const sub = this.sub(
      await this.preapproval.get({ id: inv.preapproval_id }),
    );
    requireMatch(
      mpMoney(sub.auto_recurring.transaction_amount).amountMinor ===
        mpMoney(inv.transaction_amount).amountMinor,
    );
    if (!inv.payment) return [];
    const p = await this.manualPayment(inv.payment.id, sub.external_reference);
    requireMatch(
      p.money.amountMinor === mpMoney(inv.transaction_amount).amountMinor,
    );
    const anchor = (
      sub.auto_recurring.start_date ?? sub.date_created
    ).getUTCDate();
    return [
      {
        ...p,
        interval: sub.auto_recurring.frequency === 12 ? 'year' : 'month',
        subscriptionId: sub.id,
        cycleId: inv.id,
        period: {
          startsAt: inv.debit_date,
          endsAt: nextCalendarBoundary(
            inv.debit_date,
            sub.auto_recurring.frequency === 12 ? 'year' : 'month',
            anchor,
          ),
        },
      },
    ];
  }
  private async subscription(id: string): Promise<VerifiedSubscription> {
    const sub = this.sub(await this.preapproval.get({ id }));
    const payments: VerifiedPayment[] = [];
    for (let offset = 0; offset < 10000; offset += 100) {
      const page = await this.invoice.search({
        options: { preapproval_id: id, offset, limit: 100 },
      });
      for (const invoice of page.results ?? [])
        payments.push(...(await this.invoicePayments(invoice)));
      if ((page.results?.length ?? 0) < 100)
        return {
          id,
          reference: sub.external_reference,
          stopped: ['cancelled', 'paused'].includes(sub.status),
          payments,
        };
    }
    throw new GatewayError('BILLING_SEARCH_REVIEW', true);
  }
  async read(
    topic: string,
    id: string,
  ): Promise<{
    payments: VerifiedPayment[];
    subscription?: VerifiedSubscription;
  }> {
    await this.assertAccount();
    if (topic === 'subscription_preapproval') {
      const subscription = await this.subscription(id);
      return { subscription, payments: subscription.payments };
    }
    if (topic === 'subscription_authorized_payment')
      return {
        payments: await this.invoicePayments(await this.invoice.get({ id })),
      };
    if (topic === 'topic_chargebacks_wh') {
      const cb = chargebackSchema.parse(
        await this.chargebackGet(encodeURIComponent(id)),
      );
      requireMatch(cb.live_mode === this.settings.resourceLiveMode);
      const payments: VerifiedPayment[] = [];
      for (const paymentId of cb.payments)
        payments.push(...(await this.read('payment', paymentId)).payments);
      return { payments };
    }
    if (topic === 'payment') {
      const numericId = Number(id);
      requireMatch(Number.isSafeInteger(numericId));
      const invoices = await this.invoice.search({
        options: { payment_id: numericId, limit: 2 },
      });
      requireMatch((invoices.results?.length ?? 0) <= 1);
      return {
        payments: invoices.results?.[0]
          ? await this.invoicePayments(invoices.results[0])
          : [await this.manualPayment(id)],
      };
    }
    throw new GatewayError('BILLING_TOPIC_UNSUPPORTED', true);
  }
  async reconcile(c: CheckoutCommand, checkoutId?: string) {
    await this.assertAccount();
    if (c.mode === 'automatic') {
      const found = await this.findCheckout(c, checkoutId);
      if (!found) return { payments: [] };
      const subscription = await this.subscription(found.id);
      return { subscription, payments: subscription.payments };
    }
    const payments: VerifiedPayment[] = [];
    for (let offset = 0; offset < 10000; offset += 100) {
      const page = await this.payment.search({
        options: { external_reference: c.reference, offset, limit: 100 },
      });
      for (const p of page.results ?? []) {
        requireMatch(p.id);
        payments.push(...(await this.read('payment', String(p.id))).payments);
      }
      if ((page.results?.length ?? 0) < 100) return { payments };
    }
    throw new GatewayError('BILLING_SEARCH_REVIEW', true);
  }
  async stopRenewal(id: string, operationId: string) {
    await this.assertAccount();
    const sub = this.sub(await this.preapproval.get({ id }));
    if (['cancelled', 'paused'].includes(sub.status)) return true;
    await this.preapproval.update({
      id,
      body: { status: 'cancelled' },
      requestOptions: { idempotencyKey: operationId, maxRetries: 0 },
    });
    return ['cancelled', 'paused'].includes(
      this.sub(await this.preapproval.get({ id })).status,
    );
  }
}
