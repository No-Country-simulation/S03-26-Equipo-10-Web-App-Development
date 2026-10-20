import {
  assertQuota,
  evaluateAccess,
  hasFeature,
  startTrial,
} from '../src/modules/billing/domain/access-policy';
import {
  manualPaidPeriod,
  nextCalendarBoundary,
} from '../src/modules/billing/domain/calendar';
import type {
  AccessPeriod,
  PlanFeatures,
} from '../src/modules/billing/domain/billing.types';

const at = (value: string) => new Date(value);
const features: PlanFeatures = {
  media: true,
  analytics: true,
  scoring: true,
  business_intelligence: false,
  bi_statistics: true,
  api_keys: true,
  webhooks: false,
};
const paid: AccessPeriod = {
  kind: 'paid',
  startsAt: at('2026-01-01Z'),
  endsAt: at('2026-02-01Z'),
  revoked: false,
};
const access = (now: string, periods: readonly AccessPeriod[], graceDays = 7) =>
  evaluateAccess({ enabled: true, now: at(now), periods, graceDays });

describe('billing calendar periods', () => {
  it('clamps January 31 and restores the original day in March', () => {
    const february = nextCalendarBoundary(
      at('2026-01-31T23:15:42.123Z'),
      'month',
      31,
    );
    expect(february.toISOString()).toBe('2026-02-28T23:15:42.123Z');
    expect(nextCalendarBoundary(february, 'month', 31).toISOString()).toBe(
      '2026-03-31T23:15:42.123Z',
    );
  });
  it('preserves leap-day anchor across annual renewals', () => {
    expect(
      nextCalendarBoundary(
        at('2024-02-29T12:00:00Z'),
        'year',
        29,
      ).toISOString(),
    ).toBe('2025-02-28T12:00:00.000Z');
    expect(
      nextCalendarBoundary(
        at('2027-02-28T12:00:00Z'),
        'year',
        29,
      ).toISOString(),
    ).toBe('2028-02-29T12:00:00.000Z');
  });
  it('extends the existing paid horizon when paying early without mutating input dates', () => {
    const paidThrough = at('2026-01-31Z');
    const period = manualPaidPeriod({
      paidAt: at('2026-01-20Z'),
      paidThrough,
      interval: 'month',
      anchorDay: 31,
    });
    expect(period.startsAt.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(period.endsAt.toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(paidThrough.toISOString()).toBe('2026-01-31T00:00:00.000Z');
    expect(period.startsAt).not.toBe(paidThrough);
  });
  it('starts a late payment now, with a new billing anchor', () => {
    const result = manualPaidPeriod({
      paidAt: at('2026-03-05Z'),
      paidThrough: at('2026-01-31Z'),
      interval: 'month',
      anchorDay: 31,
    });
    expect(result.endsAt.toISOString()).toBe('2026-04-05T00:00:00.000Z');
  });
  it.each([0, 32, 1.5, NaN])('rejects invalid anchor %s', (anchor) => {
    expect(() =>
      nextCalendarBoundary(at('2026-01-01Z'), 'month', anchor),
    ).toThrow('BILLING_CALENDAR_INVALID');
  });
  it('rejects invalid dates rather than silently producing invalid access', () => {
    expect(() => nextCalendarBoundary(new Date(NaN), 'month', 1)).toThrow(
      'BILLING_CALENDAR_INVALID',
    );
  });
});

describe('trial and access policy', () => {
  it('keeps existing tenants unrestricted when enforcement is disabled', () => {
    expect(
      evaluateAccess({
        enabled: false,
        now: at('2026-03-01Z'),
        periods: [],
        graceDays: 7,
      }),
    ).toEqual({ mode: 'unrestricted', canMutate: true });
  });
  it('denies mutations without any trial or paid coverage', () => {
    expect(access('2026-01-01Z', [])).toEqual({
      mode: 'read_only',
      canMutate: false,
    });
  });
  it('starts only one explicit trial and counts whole UTC days', () => {
    const trial = startTrial({
      now: at('2026-01-31T12:00:00Z'),
      days: 14,
      alreadyConsumed: false,
      hasPaidCoverage: false,
    });
    expect(trial.endsAt.toISOString()).toBe('2026-02-14T12:00:00.000Z');
    expect(access('2026-02-14T11:59:59Z', [trial]).mode).toBe('trial');
    expect(access('2026-02-14T12:00:00Z', [trial]).mode).toBe('read_only');
    expect(() =>
      startTrial({
        now: at('2026-01-31Z'),
        days: 14,
        alreadyConsumed: true,
        hasPaidCoverage: false,
      }),
    ).toThrow('BILLING_TRIAL_UNAVAILABLE');
  });
  it.each([0, -1, 0.5, NaN])(
    'rejects a disabled or invalid trial length %s',
    (days) => {
      expect(() =>
        startTrial({
          now: at('2026-01-01Z'),
          days,
          alreadyConsumed: false,
          hasPaidCoverage: false,
        }),
      ).toThrow('BILLING_TRIAL_UNAVAILABLE');
    },
  );
  it('cannot start a trial over existing paid coverage', () => {
    expect(() =>
      startTrial({
        now: at('2026-01-01Z'),
        days: 14,
        alreadyConsumed: false,
        hasPaidCoverage: true,
      }),
    ).toThrow('BILLING_TRIAL_UNAVAILABLE');
  });
  it('uses half-open paid/grace boundaries and no grace when set to zero', () => {
    expect(access('2026-01-31T23:59:59Z', [paid]).mode).toBe('paid');
    expect(access('2026-02-01Z', [paid]).mode).toBe('grace');
    expect(access('2026-02-07T23:59:59.999Z', [paid]).canMutate).toBe(true);
    expect(access('2026-02-08Z', [paid])).toEqual({
      mode: 'read_only',
      canMutate: false,
    });
    expect(access('2026-02-01Z', [paid], 0).canMutate).toBe(false);
    expect(access('2025-12-31Z', [paid]).canMutate).toBe(false);
  });
  it('prioritizes paid coverage over trial and revoked periods never open grace', () => {
    const trial = { ...paid, kind: 'trial' as const };
    expect(access('2026-01-15Z', [trial, paid]).mode).toBe('paid');
    expect(access('2026-02-02Z', [{ ...paid, revoked: true }]).mode).toBe(
      'read_only',
    );
  });
  it('does not resurrect grace from an older period after the latest payment is refunded', () => {
    const older = { ...paid, endsAt: at('2026-01-31Z') };
    expect(
      access('2026-02-02Z', [older, { ...paid, revoked: true }]).mode,
    ).toBe('read_only');
    const current = {
      ...paid,
      startsAt: at('2026-02-01Z'),
      endsAt: at('2026-03-01Z'),
      revoked: true,
    };
    expect(access('2026-02-02Z', [paid, current]).mode).toBe('read_only');
  });
  it.each([-1, 0.1, NaN])('rejects invalid grace %s', (grace) => {
    expect(() => access('2026-02-01Z', [paid], grace)).toThrow(
      'BILLING_ACCESS_INVALID',
    );
  });
});

describe('commercial entitlements compose with RBAC and technical flags', () => {
  const input = {
    enforcementEnabled: true,
    features,
    authorized: true,
    technicalEnabled: true,
  };
  it('denies unpurchased features, including missing BI dependency', () => {
    expect(hasFeature({ ...input, feature: 'webhooks' })).toBe(false);
    expect(hasFeature({ ...input, feature: 'bi_statistics' })).toBe(false);
    expect(hasFeature({ ...input, feature: 'analytics' })).toBe(true);
    expect(hasFeature({ ...input, features: null, feature: 'analytics' })).toBe(
      false,
    );
  });
  it('disabled commercial enforcement never bypasses RBAC or technical flags', () => {
    expect(
      hasFeature({ ...input, enforcementEnabled: false, feature: 'webhooks' }),
    ).toBe(true);
    expect(
      hasFeature({
        ...input,
        enforcementEnabled: false,
        authorized: false,
        feature: 'analytics',
      }),
    ).toBe(false);
    expect(
      hasFeature({
        ...input,
        enforcementEnabled: false,
        technicalEnabled: false,
        feature: 'analytics',
      }),
    ).toBe(false);
  });
  it('handles zero, unlimited, exact boundary, overquota cleanup and replacement', () => {
    expect(() => assertQuota(0, 0, 1)).toThrow('BILLING_QUOTA_EXCEEDED');
    expect(() => assertQuota(4, 5, 1)).not.toThrow();
    expect(() => assertQuota(5, 5, 1)).toThrow('BILLING_QUOTA_EXCEEDED');
    expect(() => assertQuota(9, 5, 0)).not.toThrow();
    expect(() => assertQuota(100, null, 1)).not.toThrow();
  });
  it.each([
    [1, -1, 1],
    [-1, null, 1],
    [1, 3, -1],
    [0, 2.5, 1],
    [NaN, 5, 1],
    [Number.MAX_SAFE_INTEGER, null, 1],
  ])('rejects invalid capacity arithmetic', (used, limit, increase) => {
    expect(() => assertQuota(used!, limit, increase!)).toThrow(
      'BILLING_QUOTA_INVALID',
    );
  });
});
