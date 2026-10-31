import { BillingRuleError, type BillingInterval } from './billing.types';

export function nextCalendarBoundary(
  start: Date,
  interval: BillingInterval,
  anchorDay: number,
): Date {
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isInteger(anchorDay) ||
    anchorDay < 1 ||
    anchorDay > 31 ||
    (interval !== 'month' && interval !== 'year')
  )
    throw new BillingRuleError('BILLING_CALENDAR_INVALID');
  const target = new Date(start);
  target.setUTCDate(1);
  if (interval === 'month') target.setUTCMonth(target.getUTCMonth() + 1);
  else target.setUTCFullYear(target.getUTCFullYear() + 1);
  const last = new Date(target);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  target.setUTCDate(Math.min(anchorDay, last.getUTCDate()));
  if (!Number.isFinite(target.getTime()) || target <= start)
    throw new BillingRuleError('BILLING_CALENDAR_INVALID');
  return target;
}

export function manualPaidPeriod(input: {
  paidAt: Date;
  paidThrough: Date | null;
  interval: BillingInterval;
  anchorDay: number;
}): { startsAt: Date; endsAt: Date } {
  if (
    !Number.isFinite(input.paidAt.getTime()) ||
    (input.paidThrough !== null &&
      !Number.isFinite(input.paidThrough.getTime()))
  ) {
    throw new BillingRuleError('BILLING_CALENDAR_INVALID');
  }
  const extending =
    input.paidThrough !== null && input.paidThrough >= input.paidAt;
  const startsAt = new Date(extending ? input.paidThrough! : input.paidAt);
  const endsAt = nextCalendarBoundary(
    startsAt,
    input.interval,
    extending ? input.anchorDay : startsAt.getUTCDate(),
  );
  return { startsAt, endsAt };
}
