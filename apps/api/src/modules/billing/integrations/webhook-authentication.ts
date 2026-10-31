import { createHash } from 'node:crypto';
import Stripe from 'stripe';
import { WebhookSignatureValidator } from 'mercadopago';
import { z } from 'zod';
import type { Receipt } from '../repositories/billing-ledger.repository';
import type { ProviderSettings } from './billing.config';
import { GatewayError } from '../ports/financial-gateway.port';

export function stripeReceipt(
  raw: Buffer,
  signature: string,
  settings: ProviderSettings,
): Receipt {
  let event: Stripe.Event | undefined;
  const sdk = new Stripe(settings.credential);
  for (const secret of settings.webhookSecrets) {
    try {
      event = sdk.webhooks.constructEvent(raw, signature, secret);
      break;
    } catch {
      /* Try rotation key, never log signature/SDK error. */
    }
  }
  if (!event || event.livemode !== settings.resourceLiveMode || event.account)
    throw new GatewayError('BILLING_SIGNATURE_INVALID', true);
  const topics = new Set([
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'checkout.session.expired',
    'invoice.paid',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'payment_intent.canceled',
    'charge.refunded',
    'charge.dispute.created',
    'charge.dispute.updated',
    'charge.dispute.closed',
  ]);
  if (!topics.has(event.type))
    throw new GatewayError('BILLING_TOPIC_UNSUPPORTED', true);
  const object = z
    .object({ id: z.string().min(1).max(200) })
    .parse(event.data.object);
  return { eventKey: event.id, topic: event.type, resourceId: object.id };
}
const mpBody = z.object({
  type: z.enum([
    'payment',
    'subscription_preapproval',
    'subscription_authorized_payment',
    'topic_chargebacks_wh',
  ]),
  data: z.object({
    id: z.union([z.string(), z.number().int().safe()]).transform(String),
  }),
});
export function mercadoPagoReceipt(
  input: {
    signature: string;
    requestId: string;
    dataId: string;
    body: unknown;
  },
  settings: ProviderSettings,
  toleranceSeconds: number,
  now = Date.now(),
): Receipt {
  if (
    !/^[a-zA-Z0-9_-]{1,200}$/.test(input.dataId) ||
    !/^[a-zA-Z0-9-]{1,200}$/.test(input.requestId)
  )
    throw new GatewayError('BILLING_SIGNATURE_INVALID', true);
  let valid = false;
  for (const secret of settings.webhookSecrets) {
    try {
      WebhookSignatureValidator.validate({
        xSignature: input.signature,
        xRequestId: input.requestId,
        dataId: input.dataId.toLowerCase(),
        secret,
      });
      valid = true;
      break;
    } catch {
      /* Sanitized failure only. */
    }
  }
  // SDK 3.6.1 assumes seconds for its optional tolerance; MP documentation also
  // contains millisecond examples. Authenticate the exact ts first, normalize
  // only for freshness, and never change the HMAC manifest.
  const ts = /^ts=(\d{10}|\d{13}),v1=[a-fA-F0-9]{64}$/.exec(
    input.signature,
  )?.[1];
  const millis = ts ? Number(ts) * (ts.length === 10 ? 1000 : 1) : NaN;
  if (
    !valid ||
    !Number.isFinite(millis) ||
    Math.abs(now - millis) > toleranceSeconds * 1000
  )
    throw new GatewayError('BILLING_SIGNATURE_INVALID', true);
  const body = mpBody.parse(input.body);
  if (body.data.id.toLowerCase() !== input.dataId.toLowerCase())
    throw new GatewayError('BILLING_RESOURCE_MISMATCH', true);
  // body.id and body.type are NOT HMAC-authenticated. Bind receipt identity to
  // signed transport fields, never permanently deduplicate by payment/resource.
  return {
    eventKey: createHash('sha256')
      .update(`${input.dataId.toLowerCase()}|${input.requestId}|${ts}`)
      .digest('hex'),
    topic: body.type,
    resourceId: input.dataId.toLowerCase(),
  };
}
