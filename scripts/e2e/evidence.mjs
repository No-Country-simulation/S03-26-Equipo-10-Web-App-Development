export const caseIds = [
  'E2E-SESSION',
  'E2E-PUBLISH',
  'E2E-TENANT-CSRF',
  'E2E-RBAC',
  'E2E-MOBILE-MENU',
  'E2E-MOBILE-CAPTURE',
];
const statuses = ['passed', 'failed', 'timedOut', 'skipped', 'interrupted'];
export function summarize(records, { total, status, errors = 0 }) {
  // Explicit allowlist: no errors, titles, URLs, headers, steps, stdout or attachments.
  const cases = records.map((record) => ({
    id: caseIds.includes(record.id) ? record.id : 'unknown',
    project: ['desktop', 'mobile'].includes(record.project)
      ? record.project
      : 'unknown',
    status: statuses.includes(record.status) ? record.status : 'unknown',
    durationMs:
      Number.isFinite(record.duration) && record.duration >= 0
        ? Math.round(record.duration)
        : 0,
    retry:
      Number.isSafeInteger(record.retry) && record.retry >= 0
        ? record.retry
        : -1,
  }));
  const complete =
    status === 'passed' &&
    errors === 0 &&
    total === caseIds.length &&
    cases.length === total &&
    new Set(cases.map((c) => c.id)).size === total &&
    cases.every(
      (c) =>
        c.id !== 'unknown' &&
        c.project !== 'unknown' &&
        c.status === 'passed' &&
        c.retry === 0,
    );
  return {
    complete,
    expected: caseIds.length,
    executed: cases.length,
    passed: cases.filter((c) => c.status === 'passed').length,
    cases,
  };
}
