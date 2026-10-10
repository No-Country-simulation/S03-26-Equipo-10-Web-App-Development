import type { BiDashboard } from './api';
import type { BiStatus, BiSettings, BiRun, BiRequest } from './operations-schemas';
export const dashboardFixture: BiDashboard = {
  range: { from: '2024-02-29', to: '2024-03-01', timezone: 'UTC' },
  summary: { totalTestimonials: 2, averageRating: 4.5, statuses: [{ code: 'published', count: 2 }], views: '9007199254740993', clicks: '2', plays: '1', ctr: null },
  testimonialSeries: [{ date: '2024-02-29', snapshotAt: null, total: null, averageRating: null }, { date: '2024-03-01', snapshotAt: '2024-03-01T02:00:00Z', total: 2, averageRating: 4.5 }],
  engagementSeries: [{ date: '2024-02-29', views: '9007199254740993', clicks: '0', plays: '0', ctr: null }, { date: '2024-03-01', views: '0', clicks: '2', plays: '1', ctr: null }],
  categories: [{ categoryKey: '1', name: 'Category A', count: 2, averageRating: 4.5 }],
  freshness: { status: 'stale', frequencyHours: 1, delayToleranceMinutes: 60, staleAfterSeconds: 7200, schedulePaused: false, sourceSnapshotAt: '2024-03-01T02:00:00Z', lastPublishedAt: '2024-03-01T02:01:00Z', historyStartedAt: '2024-03-01T02:00:00Z', engagementHistoryStartedAt: '2024-02-29', dataAgeSeconds: 9000 },
};
export const actorId = '11111111-1111-4111-8111-111111111111';
export const runId = '22222222-2222-4222-8222-222222222222';
export const requestId = '33333333-3333-4333-8333-333333333333';
export const instant = '2024-03-01T02:00:00Z';
export const allowed = { allowed: true, reason: null, message: null };
export const denied = { allowed: false, reason: 'BLOCKED', message: 'Acción bloqueada por el servidor.' };
export const settingsFixture: BiSettings = { frequencyHours: 1, scheduleEnabled: true, nextScheduledAt: instant, alertFailures: true, alertDelays: true, delayToleranceMinutes: 60, version: 1, updatedAt: instant };
export const runFixture: BiRun = { id: runId, requestId: null, origin: 'scheduled', slotAt: instant, attemptNo: 1, status: 'failed', phase: 'extraction', sourceSnapshotAt: instant, startedAt: instant, finishedAt: instant, durationMs: 100, errorCode: 'BI_EXTRACTION_FAILED', errorMessage: 'No se pudo completar la extracción.', sourceCounts: null, destinationCounts: null };
export const requestFixture: BiRequest = { id: requestId, kind: 'manual', retryOfRunId: null, slotAt: instant, expiresAt: '2024-03-01T03:00:00Z', status: 'pending', createdAt: instant, startedAt: null, finishedAt: null, errorCode: null, errorMessage: null };
export const statusFixture: BiStatus = { observedAt: instant, timezone: 'UTC', service: { status: 'online', lastSeenAt: instant, heartbeatTimeoutSeconds: 60 }, schedule: { paused: false, frequencyHours: 1, nextScheduledAt: instant, delayToleranceMinutes: 60 }, budget: { slotAt: instant, maxAttempts: 3, attemptsUsed: 1, attemptsRemaining: 2, succeeded: false }, activeRun: null, activeRequest: null, freshness: { status: 'fresh', staleAfterSeconds: 7200, frequencyHours: 1, delayToleranceMinutes: 60, schedulePaused: false, sourceSnapshotAt: instant, lastPublishedAt: instant, dataAgeSeconds: 0 }, alerts: [], actions: { runNow: allowed, retry: { ...denied, runId: null }, cancel: { ...denied, requestId: null }, updateSettings: allowed } };
