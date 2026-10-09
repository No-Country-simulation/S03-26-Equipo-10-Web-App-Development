import { z } from 'zod';
import { ApplicationError } from '../../common/errors/application.error';

export const operationIdentitySchema = z.object({ tenantId: z.uuid(), actorId: z.uuid() }).strict();
export type OperationIdentity = z.infer<typeof operationIdentitySchema>;
export const idempotencyKeySchema = z.string().min(1).max(128).refine(value => !/[^A-Za-z0-9._:-]/.test(value), 'Invalid idempotency key');
export const settingsPatchSchema = z.object({
  expectedVersion: z.number().int().nonnegative().max(2147483646),
  frequencyHours: z.union([z.literal(1), z.literal(6), z.literal(24)]).optional(),
  scheduleEnabled: z.boolean().optional(),
  alertFailures: z.boolean().optional(),
  alertDelays: z.boolean().optional(),
  delayToleranceMinutes: z.union([z.literal(30), z.literal(60), z.literal(120)]).optional(),
}).strict().refine(value => Object.keys(value).length > 1, 'At least one setting is required');
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;
export const loadRequestInputSchema = z.object({
  kind: z.enum(['manual', 'retry']), retryOfRunId: z.uuid().transform(id => id.toLowerCase()).optional(),
}).strict().refine(value => (value.kind === 'retry') === (value.retryOfRunId !== undefined), 'Retry requires its failed run');
export type LoadRequestInput = z.infer<typeof loadRequestInputSchema>;
export type RunOrigin = 'legacy' | 'scheduled' | 'cli' | 'manual' | 'retry';
export type RunStatus = 'running' | 'succeeded' | 'failed' | 'abandoned';
export type RequestStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'expired' | 'skipped';

export interface BiSettings {
  frequencyHours: 1 | 6 | 24;
  scheduleEnabled: boolean;
  nextScheduledAt: string | null;
  alertFailures: boolean;
  alertDelays: boolean;
  delayToleranceMinutes: 30 | 60 | 120;
  version: number;
  updatedAt: string | null;
}
export interface LoadRequest {
  id: string;
  kind: 'manual' | 'retry';
  retryOfRunId: string | null;
  slotAt: string;
  expiresAt: string;
  status: RequestStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
}
export interface BiRun {
  id: string; requestId: string | null; origin: RunOrigin; slotAt: string; attemptNo: number;
  status: RunStatus; phase: 'extraction' | 'publication' | null; sourceSnapshotAt: string | null;
  startedAt: string; finishedAt: string | null; durationMs: number | null; errorCode: string | null;
  sourceCounts: { categories: string; testimonials: string; events: string } | null;
  destinationCounts: { testimonials: string; engagement: string } | null;
}
export interface OperationsPage<T> { items: T[]; meta: { total: number; page: number; limit: number } }
export interface OperationsFilter { from: string; to: string; page: number; limit: number }
export interface RunFilter extends OperationsFilter { status?: RunStatus; origin?: RunOrigin }
export interface RequestFilter extends OperationsFilter { status?: RequestStatus }
export interface ControlAudit {
  id: string; actorId: string; action: 'settings_updated' | 'request_created' | 'request_cancelled';
  requestId: string | null; settingsBefore: BiSettings | null; settingsAfter: BiSettings | null; createdAt: string;
}
export type OperationsErrorCode = 'BI_OPERATIONS_DISABLED' | 'BI_SETTINGS_CONFLICT' | 'BI_OPERATION_BUSY'
  | 'BI_REQUEST_CONFLICT' | 'BI_ALREADY_RUNNING' | 'BI_RECOVERY_REQUIRED' | 'BI_ALREADY_SUCCEEDED'
  | 'BI_ATTEMPTS_EXHAUSTED' | 'BI_RETRY_NOT_ALLOWED' | 'BI_REQUEST_NOT_PENDING' | 'IDEMPOTENCY_KEY_REUSED';
export class BiOperationsError extends ApplicationError {
  constructor(code: OperationsErrorCode) {
    super(code, code === 'BI_OPERATIONS_DISABLED' ? 'unavailable' : 'conflict', code);
  }
}

/** Next aligned UTC boundary, strictly after the supplied instant. */
export function nextScheduledAt(at: Date, frequencyHours: BiSettings['frequencyHours']): Date {
  const width = frequencyHours * 3600000;
  return new Date((Math.floor(at.getTime() / width) + 1) * width);
}

/** Internal, tenant-scoped observation from a single read-only warehouse transaction. */
export interface OperationsState {
  now: string;
  settings: BiSettings;
  workerLastSeenAt: string | null;
  activeRequest: LoadRequest | null;
  activeRun: BiRun | null;
  lease: { runId: string; until: string | null } | null;
  attempts: number;
  succeededThisHour: boolean;
  latestFailure: BiRun | null;
  lastSuccessAt: string | null;
  latestExpiredRequest: LoadRequest | null;
  sourceSnapshotAt: string | null;
  lastPublishedAt: string | null;
}
