import { billingReturnUrl } from './provider-values';
import Stripe from 'stripe';
import type { ProviderSettings } from './billing.config';
import type {
  CheckoutCommand,
  FinancialGateway,
  GatewayCheckout,
  VerifiedPayment,
  VerifiedSubscription,
  GatewaySnapshot,
} from '../ports/financial-gateway.port';
import { GatewayError } from '../ports/financial-gateway.port';
import {
  checkoutUrl,
  requireMatch,
  stripeAmount,
  referenceValue,
} from './provider-values';

const objectId = (v: string | { id: string } | null | undefined) =>
  typeof v === 'string' ? v : v?.id;
export class StripeGateway implements FinancialGateway {
  readonly sdk: Stripe;
  constructor(
    private readonly settings: ProviderSettings,
    private readonly returnUrl: string,
    sdk?: Stripe,
  ) {
    this.sdk =
      sdk ??
      new Stripe(settings.credential, { timeout: 10000, maxNetworkRetries: 0 });
  }
  async assertAccount() {
    const account = await this.sdk.accounts.retrieve(this.settings.sellerId);
    requireMatch(account.id === this.settings.sellerId);
  }
  private mode(value: { livemode: boolean }) {
    requireMatch(value.livemode === this.settings.resourceLiveMode);
  }
  async syncPrice(c: Parameters<FinancialGateway['syncPrice']>[0]) {
    requireMatch(c.money.currency === 'USD');
    const amount = stripeAmount(c.money.amountMinor);
    const productId = `cms_${c.id.replaceAll('-', '')}`;
    let product: Stripe.Product;
    try {
      product = await this.sdk.products.retrieve(productId);
    } catch (e) {
      if (
        !(e instanceof Stripe.errors.StripeInvalidRequestError) ||
        e.code !== 'resource_missing'
      )
        throw e;
      product = await this.sdk.products.create(
        { id: productId, name: c.title, metadata: { cms_price: c.id } },
        { idempotencyKey: `catalog-product:${c.id}` },
      );
    }
    this.mode(product);
    requireMatch(product.metadata.cms_price === c.id);
    const prices = await this.sdk.prices.list({
      lookup_keys: [`cms_${c.id}`],
      limit: 2,
    });
    requireMatch(prices.data.length <= 1);
    const price =
      prices.data[0] ??
      (await this.sdk.prices.create(
        {
          product: productId,
          currency: 'usd',
          unit_amount: amount,
          recurring: { interval: c.interval },
          lookup_key: `cms_${c.id}`,
          metadata: { cms_price: c.id },
        },
        { idempotencyKey: `catalog-price:${c.id}` },
      ));
    this.mode(price);
    requireMatch(
      price.unit_amount === amount &&
        price.currency === 'usd' &&
        price.recurring?.interval === c.interval &&
        objectId(price.product) === productId,
    );
    return { productId, priceId: price.id };
  }
  private checkout(
    session: Stripe.Checkout.Session,
    c: CheckoutCommand,
  ): GatewayCheckout {
    this.mode(session);
    requireMatch(
      session.client_reference_id === c.reference &&
        session.metadata?.cms_operation === c.operationId &&
        session.metadata.cms_tenant === c.tenantId,
    );
    requireMatch(
      session.amount_total === stripeAmount(c.money.amountMinor) &&
        session.currency === 'usd',
    );
    const sub = objectId(session.subscription);
    return {
      id: session.id,
      url: session.url
        ? checkoutUrl(session.url, ['checkout.stripe.com'])
        : null,
      ...(sub ? { subscriptionId: sub } : {}),
    };
  }
  async createCheckout(c: CheckoutCommand) {
    requireMatch(c.money.currency === 'USD');
    const metadata = {
      cms_reference: c.reference,
      cms_operation: c.operationId,
      cms_tenant: c.tenantId,
      cms_subscription: c.subscriptionId,
    };
    const line =
      c.mode === 'automatic'
        ? { price: c.externalPriceId!, quantity: 1 }
        : {
            price_data: {
              currency: 'usd',
              unit_amount: stripeAmount(c.money.amountMinor),
              product_data: { name: c.title },
            },
            quantity: 1,
          };
    if (c.mode === 'automatic') requireMatch(c.externalPriceId);
    const session = await this.sdk.checkout.sessions.create(
      {
        mode: c.mode === 'automatic' ? 'subscription' : 'payment',
        client_reference_id: c.reference,
        line_items: [line],
        metadata,
        success_url: billingReturnUrl(this.returnUrl, c.operationId),
        cancel_url: billingReturnUrl(this.returnUrl, c.operationId),
        ...(c.mode === 'automatic'
          ? { subscription_data: { metadata } }
          : { payment_intent_data: { metadata } }),
      },
      { idempotencyKey: c.operationId },
    );
    return this.checkout(session, c);
  }
  async findCheckout(c: CheckoutCommand, knownId?: string) {
    if (knownId) {
      const session = await this.sdk.checkout.sessions.retrieve(knownId);
      return this.checkout(session, c);
    }
    let pages = 0;
    // Paginate instead of assuming absence from the first page. Absence never
    // authorizes another financial POST, even after a complete scan.
    for await (const session of this.sdk.checkout.sessions.list({
      limit: 100,
    })) {
      if (session.metadata?.cms_operation === c.operationId)
        return this.checkout(session, c);
      if (++pages >= 10000)
        throw new GatewayError('BILLING_SEARCH_REVIEW', true);
    }
    return null;
  }
  private async payment(
    id: string,
    reference?: string,
  ): Promise<VerifiedPayment> {
    const intent = await this.sdk.paymentIntents.retrieve(id);
    this.mode(intent);
    const ref = reference ?? intent.metadata.cms_reference;
    requireMatch(
      (reference ||
        (intent.metadata.cms_tenant && intent.metadata.cms_subscription)) &&
        ref &&
        intent.currency === 'usd' &&
        Number.isSafeInteger(intent.amount),
    );
    const chargeId = objectId(intent.latest_charge);
    const charge = chargeId ? await this.sdk.charges.retrieve(chargeId) : null;
    if (charge) {
      this.mode(charge);
      requireMatch(
        objectId(charge.payment_intent) === intent.id &&
          charge.amount === intent.amount,
      );
    }
    const adjustments: VerifiedPayment['adjustments'] = [];
    if (charge) {
      for await (const refund of this.sdk.refunds.list({
        charge: charge.id,
        limit: 100,
      }))
        adjustments.push({
          id: refund.id,
          kind: 'refund',
          amountMinor: BigInt(refund.amount),
          status: refund.status ?? 'pending',
          confirmed: refund.status === 'succeeded',
        });
      if (charge.disputed) {
        for await (const dispute of this.sdk.disputes.list({
          charge: charge.id,
          limit: 100,
        }))
          adjustments.push({
            id: dispute.id,
            kind: 'chargeback',
            amountMinor: BigInt(dispute.amount),
            status: dispute.status,
            confirmed: dispute.status === 'lost',
          });
      }
    }
    return {
      id: intent.id,
      reference: ref,
      ...(reference
        ? {}
        : {
            tenantId: intent.metadata.cms_tenant!,
            localSubscriptionId: intent.metadata.cms_subscription!,
          }),
      money: { amountMinor: BigInt(intent.amount), currency: 'USD' },
      status:
        intent.status === 'succeeded'
          ? 'succeeded'
          : intent.status === 'canceled'
            ? 'canceled'
            : intent.status === 'requires_payment_method' &&
                intent.last_payment_error
              ? 'failed'
              : 'pending',
      providerStatus: intent.status,
      refundedMinor: BigInt(charge?.amount_refunded ?? 0),
      chargedBack: adjustments.some(
        (a) => a.kind === 'chargeback' && a.confirmed,
      ),
      paidAt: new Date(),
      adjustments,
    };
  }
  private async invoice(id: string): Promise<VerifiedPayment[]> {
    const invoice = await this.sdk.invoices.retrieve(id);
    this.mode(invoice);
    requireMatch(invoice.currency === 'usd');
    const subId = objectId(invoice.parent?.subscription_details?.subscription);
    requireMatch(subId);
    const sub = await this.sdk.subscriptions.retrieve(subId);
    this.mode(sub);
    const reference = sub.metadata.cms_reference;
    requireMatch(reference);
    const lines = [];
    for await (const line of this.sdk.invoices.listLineItems(id, {
      limit: 100,
    }))
      lines.push(line);
    requireMatch(
      lines.length === 1 &&
        ['subscription_create', 'subscription_cycle'].includes(
          invoice.billing_reason ?? '',
        ),
    );
    const line = lines[0]!;
    requireMatch(
      line.amount === invoice.total &&
        line.currency === 'usd' &&
        !line.parent?.subscription_item_details?.proration,
    );
    const externalPriceId = objectId(line.pricing?.price_details?.price);
    requireMatch(externalPriceId);
    const price = await this.sdk.prices.retrieve(externalPriceId);
    this.mode(price);
    requireMatch(
      price.currency === 'usd' &&
        price.unit_amount === invoice.total &&
        ['month', 'year'].includes(price.recurring?.interval ?? '') &&
        price.recurring?.interval_count === 1,
    );
    requireMatch(sub.metadata.cms_tenant && sub.metadata.cms_subscription);
    const results: VerifiedPayment[] = [];
    for await (const ip of this.sdk.invoicePayments.list({
      invoice: id,
      limit: 100,
    })) {
      const pi = objectId(ip.payment.payment_intent);
      if (!pi) {
        if (ip.status === 'paid')
          throw new GatewayError('BILLING_UNSUPPORTED_INVOICE_PAYMENT', true);
        continue;
      }
      const p = await this.payment(pi, reference);
      requireMatch(p.money.amountMinor === BigInt(invoice.total));
      results.push({
        ...p,
        paidAt: invoice.status_transitions.paid_at
          ? new Date(invoice.status_transitions.paid_at * 1000)
          : p.paidAt,
        tenantId: sub.metadata.cms_tenant,
        localSubscriptionId: sub.metadata.cms_subscription,
        externalPriceId,
        interval: price.recurring!.interval as 'month' | 'year',
        subscriptionId: subId,
        cycleId: invoice.id,
        period: {
          startsAt: new Date(line.period.start * 1000),
          endsAt: new Date(line.period.end * 1000),
        },
      });
    }
    return results;
  }
  private async subscription(id: string): Promise<VerifiedSubscription> {
    const sub = await this.sdk.subscriptions.retrieve(id);
    this.mode(sub);
    requireMatch(sub.metadata.cms_reference);
    const payments: VerifiedPayment[] = [];
    for await (const invoice of this.sdk.invoices.list({
      subscription: id,
      limit: 100,
    })) {
      if (!['draft', 'void'].includes(invoice.status ?? ''))
        payments.push(...(await this.invoice(invoice.id)));
    }
    return {
      id,
      reference: sub.metadata.cms_reference,
      stopped: sub.cancel_at_period_end || sub.status === 'canceled',
      payments,
    };
  }
  async read(topic: string, id: string): Promise<GatewaySnapshot> {
    await this.assertAccount();
    if (topic.startsWith('invoice.'))
      return { payments: await this.invoice(id) };
    if (topic.startsWith('customer.subscription.')) {
      const subscription = await this.subscription(id);
      return { subscription, payments: subscription.payments };
    }
    if (topic.startsWith('checkout.session.')) {
      const session = await this.sdk.checkout.sessions.retrieve(id);
      this.mode(session);
      if (session.status === 'expired') {
        requireMatch(
          session.payment_status === 'unpaid' &&
            !session.subscription &&
            session.currency === 'usd' &&
            Number.isSafeInteger(session.amount_total) &&
            session.amount_total! > 0 &&
            session.metadata?.cms_reference === session.client_reference_id,
        );
        // Current authenticated state, not the event name or browser return.
        const payments = session.payment_intent
          ? [await this.payment(objectId(session.payment_intent)!)]
          : [];
        requireMatch(
          payments.every(
            (p) => p.status === 'canceled' || p.status === 'failed',
          ),
        );
        return {
          payments,
          checkoutExpiration: {
            checkoutId: session.id,
            reference: referenceValue.parse(session.client_reference_id),
            operationId: referenceValue.parse(session.metadata?.cms_operation),
            tenantId: referenceValue.parse(session.metadata?.cms_tenant),
            localSubscriptionId: referenceValue.parse(
              session.metadata?.cms_subscription,
            ),
            money: {
              amountMinor: BigInt(session.amount_total!),
              currency: 'USD',
            },
          },
        };
      }
      const sub = objectId(session.subscription);
      if (sub) {
        const subscription = await this.subscription(sub);
        return { subscription, payments: subscription.payments };
      }
      const pi = objectId(session.payment_intent);
      return { payments: pi ? [await this.payment(pi)] : [] };
    }
    if (topic.startsWith('charge.dispute.')) {
      const dispute = await this.sdk.disputes.retrieve(id);
      this.mode(dispute);
      const pi = objectId(dispute.payment_intent);
      requireMatch(pi);
      return this.intentRead(pi);
    }
    if (topic.startsWith('charge.')) {
      const charge = await this.sdk.charges.retrieve(id);
      this.mode(charge);
      const pi = objectId(charge.payment_intent);
      requireMatch(pi);
      return this.intentRead(pi);
    }
    if (topic.startsWith('payment_intent.')) return this.intentRead(id);
    throw new GatewayError('BILLING_TOPIC_UNSUPPORTED', true);
  }
  private async intentRead(pi: string) {
    // Invoice PaymentIntent metadata is not inherited from subscription metadata.
    const ips = await this.sdk.invoicePayments.list({
      payment: { type: 'payment_intent', payment_intent: pi },
      limit: 2,
    });
    if (ips.data[0])
      return { payments: await this.invoice(objectId(ips.data[0].invoice)!) };
    return { payments: [await this.payment(pi)] };
  }
  async reconcile(c: CheckoutCommand, checkoutId?: string) {
    await this.assertAccount();
    if (checkoutId?.startsWith('sub_')) {
      const subscription = await this.subscription(checkoutId);
      return { subscription, payments: subscription.payments };
    }
    const found = await this.findCheckout(c, checkoutId);
    return found
      ? this.read('checkout.session.completed', found.id)
      : { payments: [] };
  }
  async stopRenewal(id: string, operationId: string) {
    await this.assertAccount();
    const before = await this.sdk.subscriptions.retrieve(id);
    this.mode(before);
    if (before.cancel_at_period_end || before.status === 'canceled')
      return true;
    const sub = await this.sdk.subscriptions.update(
      id,
      { cancel_at_period_end: true, proration_behavior: 'none' },
      { idempotencyKey: operationId },
    );
    this.mode(sub);
    return sub.cancel_at_period_end;
  }
}
