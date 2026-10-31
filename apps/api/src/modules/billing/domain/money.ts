import {
  BillingRuleError,
  type BillingCurrency,
  type Money,
} from './billing.types';

export const MAX_MINOR_AMOUNT = 9_223_372_036_854_775_807n;

export function moneyFromWire(
  amountMinor: string,
  currency: BillingCurrency,
): Money {
  if (
    typeof amountMinor !== 'string' ||
    !/^(0|[1-9][0-9]{0,18})$/.test(amountMinor) ||
    (currency !== 'ARS' && currency !== 'USD')
  )
    throw new BillingRuleError('BILLING_MONEY_INVALID');
  const amount = BigInt(amountMinor);
  if (amount > MAX_MINOR_AMOUNT)
    throw new BillingRuleError('BILLING_MONEY_INVALID');
  return Object.freeze({ amountMinor: amount, currency });
}

export function moneyToWire(money: Money): {
  amountMinor: string;
  currency: BillingCurrency;
} {
  if (typeof money.amountMinor !== 'bigint')
    throw new BillingRuleError('BILLING_MONEY_INVALID');
  const valid = moneyFromWire(money.amountMinor.toString(), money.currency);
  return {
    amountMinor: valid.amountMinor.toString(),
    currency: valid.currency,
  };
}

// Exact major-unit decimal text for adapters; never convert it to a JS number.
export function moneyToDecimal(money: Money): string {
  const { amountMinor } = moneyToWire(money);
  const padded = amountMinor.padStart(3, '0');
  return `${padded.slice(0, -2)}.${padded.slice(-2)}`;
}

export function moneyFromDecimal(
  amount: string,
  currency: BillingCurrency,
): Money {
  if (typeof amount !== 'string' || amount.length > 20) {
    throw new BillingRuleError('BILLING_MONEY_INVALID');
  }
  const parts = amount.split('.');
  const [whole, fraction = ''] = parts;
  if (
    parts.length > 2 ||
    !/^(0|[1-9][0-9]{0,16})$/.test(whole!) ||
    (parts.length === 2 && !/^[0-9]{1,2}$/.test(fraction))
  ) {
    throw new BillingRuleError('BILLING_MONEY_INVALID');
  }
  const minor = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
  return moneyFromWire(minor.toString(), currency);
}
