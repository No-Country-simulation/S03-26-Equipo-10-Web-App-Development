import { z } from 'zod';

export const decimalCount = z.string().regex(/^\d+$/);
export const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const utcInstant = z.string().datetime({ offset: true });
const instant = utcInstant.nullable();
const uuid = z.string().uuid();
const frequency = z.union([z.literal(1), z.literal(6), z.literal(24)]);
const tolerance = z.union([z.literal(30), z.literal(60), z.literal(120)]);
export const settingsSchema = z.object({ frequencyHours: frequency, scheduleEnabled: z.boolean(), nextScheduledAt: instant,
  alertFailures: z.boolean(), alertDelays: z.boolean(), delayToleranceMinutes: tolerance, version: integer, updatedAt: instant });
export const settingsInputSchema = settingsSchema.pick({ frequencyHours: true, scheduleEnabled: true, alertFailures: true,
  alertDelays: true, delayToleranceMinutes: true }).extend({ expectedVersion: integer.max(2147483646) }).strict();
export const requestInputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('manual') }).strict(),
  z.object({ kind: z.literal('retry'), retryOfRunId: uuid.transform(value => value.toLowerCase()) }).strict(),
]);
export const actionSchema = z.object({ allowed: z.boolean(), reason: z.string().nullable(), message: z.string().nullable() });
const retryAction = actionSchema.extend({ runId: uuid.nullable() });
const cancelAction = actionSchema.extend({ requestId: uuid.nullable() });
export const runSchema = z.object({ id: uuid, requestId: uuid.nullable(), origin: z.enum(['legacy', 'scheduled', 'cli', 'manual', 'retry']),
  slotAt: utcInstant, attemptNo: z.number().int().min(1).max(3), status: z.enum(['running', 'succeeded', 'failed', 'abandoned']),
  phase: z.enum(['extraction', 'publication']).nullable(), sourceSnapshotAt: instant, startedAt: utcInstant, finishedAt: instant,
  durationMs: integer.nullable(), errorCode: z.string().nullable(), errorMessage: z.string().nullable(),
  sourceCounts: z.object({ categories: decimalCount, testimonials: decimalCount, events: decimalCount }).nullable(),
  destinationCounts: z.object({ testimonials: decimalCount, engagement: decimalCount }).nullable() });
export const requestSchema = z.object({ id: uuid, kind: z.enum(['manual', 'retry']), retryOfRunId: uuid.nullable(),
  slotAt: utcInstant, expiresAt: utcInstant, status: z.enum(['pending', 'running', 'succeeded', 'failed', 'cancelled', 'expired', 'skipped']),
  createdAt: utcInstant, startedAt: instant, finishedAt: instant, errorCode: z.string().nullable(), errorMessage: z.string().nullable() });
export const runDetailSchema = runSchema.extend({ actions: z.object({ retry: retryAction }) });
export const requestDetailSchema = z.object({ request: requestSchema, runs: z.array(runSchema), actions: z.object({ cancel: cancelAction }) });
export const statusSchema = z.object({ observedAt: utcInstant, timezone: z.literal('UTC'),
  service: z.object({ status: z.enum(['online', 'unavailable']), lastSeenAt: instant, heartbeatTimeoutSeconds: z.literal(60) }),
  schedule: z.object({ paused: z.boolean(), frequencyHours: frequency, nextScheduledAt: instant, delayToleranceMinutes: tolerance }),
  budget: z.object({ slotAt: utcInstant, maxAttempts: z.literal(3), attemptsUsed: integer.max(3), attemptsRemaining: integer.max(3), succeeded: z.boolean() }),
  activeRun: runSchema.nullable(), activeRequest: requestSchema.nullable(),
  freshness: z.object({ status: z.enum(['not_loaded', 'fresh', 'stale']), staleAfterSeconds: integer, frequencyHours: frequency,
    delayToleranceMinutes: tolerance, schedulePaused: z.boolean(), sourceSnapshotAt: instant, lastPublishedAt: instant,
    dataAgeSeconds: z.number().finite().nonnegative().nullable() }),
  alerts: z.array(z.object({ code: z.string(), severity: z.enum(['warning', 'error']), message: z.string(), runId: uuid.optional(), requestId: uuid.optional() })),
  actions: z.object({ runNow: actionSchema, retry: retryAction, cancel: cancelAction, updateSettings: actionSchema }) });
export const auditSchema = z.object({ id: uuid, actorId: uuid, action: z.enum(['settings_updated', 'request_created', 'request_cancelled']),
  requestId: uuid.nullable(), settingsBefore: settingsSchema.nullable(), settingsAfter: settingsSchema.nullable(), createdAt: utcInstant });
export const receiptSchema = z.object({ id: uuid, status: z.literal('accepted') });
export const operationsMetaSchema = z.object({ total: integer, page: integer.min(1).max(10000), limit: integer.min(1).max(100) });
export type BiSettings = z.infer<typeof settingsSchema>;
export type SettingsInput = z.infer<typeof settingsInputSchema>;
export type RequestInput = z.infer<typeof requestInputSchema>;
export type BiStatus = z.infer<typeof statusSchema>;
export type BiRun = z.infer<typeof runSchema>;
export type BiRequest = z.infer<typeof requestSchema>;
export type RunDetail = z.infer<typeof runDetailSchema>;
export type RequestDetail = z.infer<typeof requestDetailSchema>;
export type BiAudit = z.infer<typeof auditSchema>;
export type BiAction = z.infer<typeof actionSchema>;
export type BiPage<T> = { items: T[]; meta: z.infer<typeof operationsMetaSchema> };
