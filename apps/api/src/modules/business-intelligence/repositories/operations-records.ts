import { Prisma } from '@prisma/client';
import type { BiRun, BiSettings, LoadRequest } from '../operations.types';
import { hourUtc } from '../etl.types';

export const settingsProjection = Prisma.sql`frequency_hours AS "frequencyHours", schedule_enabled AS "scheduleEnabled",
  next_scheduled_at AS "nextScheduledAt", alert_failures AS "alertFailures", alert_delays AS "alertDelays",
  delay_tolerance_minutes AS "delayToleranceMinutes", version, updated_at AS "updatedAt"`;
type SettingsRow = Omit<BiSettings, 'nextScheduledAt' | 'updatedAt'> & { nextScheduledAt: Date | null; updatedAt: Date };
export const requestProjection = Prisma.sql`id, kind, retry_of_run_id AS "retryOfRunId", slot_at AS "slotAt",
  expires_at AS "expiresAt", status, created_at AS "createdAt", started_at AS "startedAt",
  finished_at AS "finishedAt", error_code AS "errorCode"`;
export type RequestRow = Omit<LoadRequest, 'slotAt' | 'expiresAt' | 'createdAt' | 'startedAt' | 'finishedAt'> & {
  slotAt: Date; expiresAt: Date; createdAt: Date; startedAt: Date | null; finishedAt: Date | null;
};
export function requestRecord(row: RequestRow): LoadRequest {
  return { ...row, slotAt: row.slotAt.toISOString(), expiresAt: row.expiresAt.toISOString(), createdAt: row.createdAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null, finishedAt: row.finishedAt?.toISOString() ?? null };
}
export async function databaseTime(tx: Prisma.TransactionClient): Promise<Date> {
  const [row] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT date_trunc('milliseconds', clock_timestamp()) AS now`;
  if (!row) throw new Error('BI_CLOCK_UNAVAILABLE');
  return row.now;
}
export async function readSettings(tx: Prisma.TransactionClient, tenantId: string, now: Date): Promise<BiSettings> {
  const [row] = await tx.$queryRaw<SettingsRow[]>(Prisma.sql`SELECT ${settingsProjection} FROM etl.tenant_settings WHERE tenant_id = ${tenantId}::uuid`);
  return row ? { ...row, nextScheduledAt: row.nextScheduledAt?.toISOString() ?? null, updatedAt: row.updatedAt.toISOString() }
    : { frequencyHours: 1, scheduleEnabled: true, nextScheduledAt: hourUtc(now).toISOString(), alertFailures: true,
      alertDelays: true, delayToleranceMinutes: 60, version: 0, updatedAt: null };
}
export async function findRequest(tx: Prisma.TransactionClient, tenantId: string, id: string): Promise<LoadRequest | null> {
  const [row] = await tx.$queryRaw<RequestRow[]>(Prisma.sql`SELECT ${requestProjection} FROM etl.load_requests
    WHERE tenant_id = ${tenantId}::uuid AND id = ${id}::uuid`);
  return row ? requestRecord(row) : null;
}

/** Same lock and order required in all future worker claims: advisory -> state/settings/request rows. */
export async function lockOperationsTenant(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${tenantId}::uuid::text, 543004))`;
}

export const runProjection = Prisma.sql`id, request_id AS "requestId", origin, slot_at AS "slotAt", attempt_no AS "attemptNo",
  status, phase, source_snapshot_at AS "sourceSnapshotAt", started_at AS "startedAt", finished_at AS "finishedAt",
  error_code AS "errorCode", extraction_completed_at AS "extractionCompletedAt",
  source_category_count AS categories, source_testimonial_count AS testimonials, source_event_count AS events,
  snapshot_row_count AS snapshots, engagement_row_count AS engagement`;
export type RunRow = Omit<BiRun, 'slotAt' | 'sourceSnapshotAt' | 'startedAt' | 'finishedAt' | 'durationMs' | 'sourceCounts' | 'destinationCounts'> & {
  slotAt: Date; sourceSnapshotAt: Date | null; startedAt: Date; finishedAt: Date | null; extractionCompletedAt: Date | null;
  categories: bigint; testimonials: bigint; events: bigint; snapshots: bigint; engagement: bigint;
};
export function runRecord(row: RunRow): BiRun {
  return { id: row.id, requestId: row.requestId, origin: row.origin, slotAt: row.slotAt.toISOString(), attemptNo: row.attemptNo,
    status: row.status, phase: row.phase, sourceSnapshotAt: row.sourceSnapshotAt?.toISOString() ?? null,
    startedAt: row.startedAt.toISOString(), finishedAt: row.finishedAt?.toISOString() ?? null,
    durationMs: row.finishedAt ? row.finishedAt.getTime() - row.startedAt.getTime() : null, errorCode: row.errorCode,
    sourceCounts: row.extractionCompletedAt || row.status === 'succeeded'
      ? { categories: row.categories.toString(), testimonials: row.testimonials.toString(), events: row.events.toString() } : null,
    destinationCounts: row.status === 'succeeded' ? { testimonials: row.snapshots.toString(), engagement: row.engagement.toString() } : null };
}
