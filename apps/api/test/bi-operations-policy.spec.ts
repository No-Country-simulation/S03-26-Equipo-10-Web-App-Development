import { randomUUID } from 'node:crypto';
import type { BiRun, BiSettings, LoadRequest, OperationsState } from '../src/modules/business-intelligence/operations.types';
import { freshnessPolicy, operationsStatus, safeBiError } from '../src/modules/business-intelligence/services/operations-policy';

const now = '2026-10-09T12:30:00.000Z';
const settings: BiSettings = { frequencyHours: 1, scheduleEnabled: true, nextScheduledAt: '2026-10-09T13:00:00.000Z',
  alertFailures: true, alertDelays: true, delayToleranceMinutes: 60, version: 1, updatedAt: now };
const failed: BiRun = { id: randomUUID(), requestId: null, origin: 'scheduled', slotAt: '2026-10-09T12:00:00.000Z',
  attemptNo: 1, status: 'failed', phase: 'extraction', sourceSnapshotAt: null, startedAt: '2026-10-09T12:00:00.000Z',
  finishedAt: '2026-10-09T12:01:00.000Z', durationMs: 60000, errorCode: 'BI_ETL_FAILED', sourceCounts: null, destinationCounts: null };
const pending: LoadRequest = { id: randomUUID(), kind: 'manual', retryOfRunId: null, slotAt: '2026-10-09T12:00:00.000Z',
  expiresAt: '2026-10-09T13:00:00.000Z', status: 'pending', createdAt: now, startedAt: null, finishedAt: null, errorCode: null };
function state(patch: Partial<OperationsState> = {}): OperationsState {
  return { now, settings, workerLastSeenAt: now, activeRequest: null, activeRun: null, lease: null, attempts: 0,
    succeededThisHour: false, latestFailure: null, lastSuccessAt: null, latestExpiredRequest: null,
    sourceSnapshotAt: null, lastPublishedAt: null, ...patch };
}
const codes = (value: OperationsState) => operationsStatus(value, true, true).alerts.map(alert => alert.code);
describe('BI operation and freshness application policies', () => {
  it.each([1, 6, 24] as const)('uses frequency %ih plus tolerance with an exclusive stale boundary', frequencyHours => {
    const policy = { ...settings, frequencyHours, delayToleranceMinutes: 30 as const };
    const threshold = frequencyHours * 3600 + 1800;
    expect(freshnessPolicy(threshold, policy).status).toBe('fresh');
    expect(freshnessPolicy(threshold + 1, policy).status).toBe('stale');
    expect(freshnessPolicy(null, policy).status).toBe('not_loaded');
  });
  it('never warns a daily load as stale after two hours', () => {
    expect(codes(state({ settings: { ...settings, frequencyHours: 24 }, sourceSnapshotAt: '2026-10-09T00:00:00Z' }))).toEqual([]);
  });
  it('shows pause and suppresses only schedule delays, preserving unrecovered failures', () => {
    const result = operationsStatus(state({ settings: { ...settings, scheduleEnabled: false, nextScheduledAt: null },
      sourceSnapshotAt: '2026-10-01T00:00:00Z', latestFailure: failed }), true, true);
    expect(result.schedule.paused).toBe(true); expect(result.freshness.schedulePaused).toBe(true);
    expect(result.alerts.map(alert => alert.code)).toEqual(['BI_LOAD_FAILED']);
    expect(result.actions.runNow.allowed).toBe(true);
  });
  it('alerts on an initial overdue load and honors delay preferences', () => {
    const delayed = state({ settings: { ...settings, nextScheduledAt: '2026-10-09T10:00:00Z' } });
    expect(codes(delayed)).toContain('BI_SCHEDULE_DELAYED');
    expect(codes({ ...delayed, settings: { ...delayed.settings, alertDelays: false } })).toEqual([]);
    expect(codes(state({ settings: { ...delayed.settings, version: 0 } }))).toEqual([]);
  });
  it('differentiates failures, expiry and a lost worker and clears recovered failures without editing history', () => {
    const expired = { ...pending, status: 'expired' as const, finishedAt: '2026-10-09T12:01:00Z' };
    const input = state({ workerLastSeenAt: '2026-10-09T12:29:00Z', latestFailure: failed, latestExpiredRequest: expired });
    expect(codes(input)).toEqual(['BI_WORKER_UNAVAILABLE', 'BI_LOAD_FAILED', 'BI_REQUEST_EXPIRED']);
    expect(codes({ ...input, lastSuccessAt: now })).toEqual(['BI_WORKER_UNAVAILABLE']);
    expect(codes({ ...input, settings: { ...settings, alertFailures: false } })).toEqual(['BI_WORKER_UNAVAILABLE']);
    expect(failed.status).toBe('failed');
  });
  it('does not mutate expired pending requests and allows a new current-hour observation', () => {
    const expired = { ...pending, expiresAt: '2026-10-09T12:00:00Z' };
    const result = operationsStatus(state({ activeRequest: expired }), true, true);
    expect(result.alerts.map(alert => alert.code)).toContain('BI_REQUEST_EXPIRED');
    expect(result.actions.runNow.allowed).toBe(true); expect(result.actions.cancel.allowed).toBe(false);
    expect(expired.status).toBe('pending');
  });
  it.each([
    [{ lease: { runId: failed.id, until: '2026-10-09T12:31:00Z' } }, 'BI_ALREADY_RUNNING'],
    [{ lease: { runId: failed.id, until: '2026-10-09T12:29:00Z' } }, 'BI_RECOVERY_REQUIRED'],
    [{ activeRun: { ...failed, status: 'running' as const } }, 'BI_RECOVERY_REQUIRED'],
    [{ activeRequest: pending }, 'BI_REQUEST_CONFLICT'],
    [{ succeededThisHour: true }, 'BI_ALREADY_SUCCEEDED'],
    [{ attempts: 3 }, 'BI_ATTEMPTS_EXHAUSTED'],
    [{ workerLastSeenAt: null }, 'BI_WORKER_UNAVAILABLE'],
  ] as const)('returns an explicit blocking reason for %j', (patch, reason) => {
    expect(operationsStatus(state(patch), true, true).actions.runNow).toMatchObject({ allowed: false, reason });
  });
  it('permits retry only with a known failed run and cancellation only for live pending work', () => {
    expect(operationsStatus(state(), true, true).actions.retry.allowed).toBe(false);
    expect(operationsStatus(state({ latestFailure: failed }), true, true).actions.retry).toMatchObject({ allowed: true, runId: failed.id });
    expect(operationsStatus(state({ activeRequest: pending, workerLastSeenAt: null }), true, true).actions.cancel.allowed).toBe(true);
    expect(operationsStatus(state({ activeRequest: { ...pending, status: 'running' } }), true, true).actions.cancel.allowed).toBe(false);
  });
  it('does not advertise privileged actions to editors or controls with missing configuration', () => {
    const editor = operationsStatus(state({ latestFailure: failed, activeRequest: pending }), false, true);
    expect(Object.values(editor.actions).every(value => !value.allowed && value.reason === 'BI_ADMIN_REQUIRED')).toBe(true);
    expect(operationsStatus(state(), true, false).actions.updateSettings.reason).toBe('BI_UNAVAILABLE');
  });
  it('uses safe explanations for unknown error codes, never raw driver details', () => {
    expect(safeBiError(null)).toBeNull(); expect(safeBiError('BI_ETL_FAILED')).toContain('último corte');
    expect(safeBiError('password=synthetic-do-not-expose')).not.toContain('password');
  });
});
