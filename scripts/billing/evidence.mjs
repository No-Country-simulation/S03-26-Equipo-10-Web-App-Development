export const cases = {
  'BILLING-CATALOG': 'desktop',
  'BILLING-STRIPE-MANUAL': 'desktop',
  'BILLING-MP-AUTOMATIC': 'desktop',
  'BILLING-RECOVERY': 'desktop',
  'BILLING-MOBILE': 'mobile',
};
export function summarize(records, { status, total, errors = 0 }) {
  const safe = records.map((r) => ({
    id: Object.hasOwn(cases, r.id) ? r.id : 'unknown',
    project: ['desktop', 'mobile'].includes(r.project) ? r.project : 'unknown',
    status: ['passed', 'failed', 'timedOut', 'skipped', 'interrupted'].includes(
      r.status,
    )
      ? r.status
      : 'unknown',
    retry: Number.isSafeInteger(r.retry) && r.retry >= 0 ? r.retry : -1,
    durationMs:
      Number.isFinite(r.duration) && r.duration >= 0
        ? Math.round(r.duration)
        : 0,
  }));
  const complete =
    status === 'passed' &&
    errors === 0 &&
    total === Object.keys(cases).length &&
    safe.length === total &&
    new Set(safe.map((r) => r.id)).size === total &&
    safe.every(
      (r) =>
        r.status === 'passed' && r.retry === 0 && r.project === cases[r.id],
    );
  return {
    complete,
    expected: Object.keys(cases).length,
    executed: safe.length,
    passed: safe.filter((r) => r.status === 'passed').length,
    cases: safe,
  };
}
