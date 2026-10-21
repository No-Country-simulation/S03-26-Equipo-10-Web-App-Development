import { z } from 'zod';
import { moneyFromDecimal, moneyToDecimal } from '../domain/money';
import type { Money } from '../domain/billing.types';
import { GatewayError } from '../ports/financial-gateway.port';
export const idValue = z
  .union([z.string().min(1).max(200), z.number().int().nonnegative().safe()])
  .transform(String);
export const referenceValue = z.uuid();
export const instant = z
  .string()
  .datetime({ offset: true })
  .transform((v) => new Date(v));
export function requireMatch(condition: unknown): asserts condition {
  if (!condition) throw new GatewayError('BILLING_PROVIDER_MISMATCH', true);
}
export function stripeAmount(amount: bigint): number {
  // Stripe's published eight-digit maximum, with USD's two decimal places.
  if (amount <= 0n || amount > 99999999n)
    throw new GatewayError('BILLING_AMOUNT_UNSUPPORTED', true);
  return Number(amount);
}
export function mpAmount(money: Money): number {
  const decimal = moneyToDecimal(money);
  const amount = Number(decimal);
  // Roundtrip the SDK's actual JSON number representation; never round a price.
  if (
    money.amountMinor > 999999999999n ||
    amount <= 0 ||
    moneyFromDecimal(String(amount), money.currency).amountMinor !==
      money.amountMinor
  )
    throw new GatewayError('BILLING_AMOUNT_UNSUPPORTED', true);
  return amount;
}
export function mpMoney(amount: number | string): Money {
  if (typeof amount === 'number' && (!Number.isFinite(amount) || amount < 0))
    throw new GatewayError('BILLING_AMOUNT_INVALID', true);
  return moneyFromDecimal(String(amount), 'ARS');
}
export function checkoutUrl(value: string, hosts: string[]): string {
  const url = new URL(value);
  requireMatch(
    url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      hosts.includes(url.hostname),
  );
  return url.toString();
}

export function billingReturnUrl(base: string, operationId: string) {
  const url = new URL(base);
  url.searchParams.set('operation', operationId);
  return url.toString();
}
