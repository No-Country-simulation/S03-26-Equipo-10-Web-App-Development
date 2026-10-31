import {
  BillingRuleError,
  type AccessMode,
  type AccessPeriod,
  type BillingFeature,
  type PlanFeatures,
} from './billing.types';

const DAY_MS = 86_400_000;
const nonnegativeInteger = (value: number) =>
  Number.isSafeInteger(value) && value >= 0;

export function evaluateAccess(input: {
  enabled: boolean;
  now: Date;
  periods: readonly AccessPeriod[];
  graceDays: number;
}): { mode: AccessMode; canMutate: boolean } {
  if (!input.enabled) return { mode: 'unrestricted', canMutate: true };
  const now = input.now.getTime();
  if (!Number.isFinite(now) || !nonnegativeInteger(input.graceDays))
    throw new BillingRuleError('BILLING_ACCESS_INVALID');
  for (const period of input.periods) {
    if (
      !Number.isFinite(period.startsAt.getTime()) ||
      !Number.isFinite(period.endsAt.getTime()) ||
      period.endsAt <= period.startsAt
    ) {
      throw new BillingRuleError('BILLING_ACCESS_INVALID');
    }
  }
  const active = input.periods.filter(
    (period) =>
      !period.revoked &&
      period.startsAt.getTime() <= now &&
      now < period.endsAt.getTime(),
  );
  if (active.some((period) => period.kind === 'paid'))
    return { mode: 'paid', canMutate: true };
  if (active.some((period) => period.kind === 'trial'))
    return { mode: 'trial', canMutate: true };
  // Include revoked periods in selection: an older period must not reopen grace.
  const lastPaid = input.periods
    .filter(
      (period) => period.kind === 'paid' && period.startsAt.getTime() <= now,
    )
    .sort(
      (a, b) =>
        b.endsAt.getTime() - a.endsAt.getTime() ||
        Number(b.revoked) - Number(a.revoked),
    )[0];
  if (
    lastPaid &&
    !lastPaid.revoked &&
    now - lastPaid.endsAt.getTime() < input.graceDays * DAY_MS
  ) {
    return { mode: 'grace', canMutate: true };
  }
  return { mode: 'read_only', canMutate: false };
}

export function startTrial(input: {
  now: Date;
  days: number;
  alreadyConsumed: boolean;
  hasPaidCoverage: boolean;
}): AccessPeriod {
  const endsAt = new Date(input.now.getTime() + input.days * DAY_MS);
  if (
    input.alreadyConsumed ||
    input.hasPaidCoverage ||
    !nonnegativeInteger(input.days) ||
    input.days === 0 ||
    !Number.isFinite(input.now.getTime()) ||
    !Number.isFinite(endsAt.getTime())
  )
    throw new BillingRuleError('BILLING_TRIAL_UNAVAILABLE');
  return {
    kind: 'trial',
    startsAt: new Date(input.now),
    endsAt,
    revoked: false,
  };
}

export function hasFeature(input: {
  enforcementEnabled: boolean;
  feature: BillingFeature;
  features: PlanFeatures | null;
  authorized: boolean;
  technicalEnabled: boolean;
}): boolean {
  if (!input.authorized || !input.technicalEnabled) return false;
  if (!input.enforcementEnabled) return true;
  if (!input.features?.[input.feature]) return false;
  return (
    input.feature !== 'bi_statistics' || input.features.business_intelligence
  );
}

// Caller must read capacity and mutate under the SAME tenant lock/transaction.
export function assertQuota(
  used: number,
  limit: number | null,
  increase: number,
): void {
  if (
    !nonnegativeInteger(used) ||
    !nonnegativeInteger(increase) ||
    !Number.isSafeInteger(used + increase) ||
    (limit !== null && !nonnegativeInteger(limit))
  )
    throw new BillingRuleError('BILLING_QUOTA_INVALID');
  if (increase > 0 && limit !== null && used + increase > limit)
    throw new BillingRuleError('BILLING_QUOTA_EXCEEDED');
}
