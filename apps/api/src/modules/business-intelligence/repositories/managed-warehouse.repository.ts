import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { EtlError, hourUtc, type Lease } from '../etl.types';
import { nextScheduledAt, type RunOrigin } from '../operations.types';
import { databaseTime, lockOperationsTenant, readSettings } from './operations-records';
import { WarehouseRepository } from './warehouse.repository';

/** Protocol 1 worker: every claim/control transition shares the API's tenant lock. */
export class ManagedWarehouseRepository extends WarehouseRepository {
  override readonly operations: boolean = true;

  protected override lockTenant(tx: Prisma.TransactionClient, tenantId: string) {
    return lockOperationsTenant(tx, tenantId);
  }

  override async claim(tenantId: string, _slot: Date, origin: 'scheduled' | 'cli' = 'scheduled'): Promise<Lease | null> {
    const deadline = Date.now() + 300000;
    return this.transaction(async tx => {
      await this.lockTenant(tx, tenantId);
      await tx.$executeRaw`INSERT INTO etl.tenant_settings (tenant_id) VALUES (${tenantId}::uuid) ON CONFLICT DO NOTHING`;
      await tx.$executeRaw`INSERT INTO etl.tenant_load_state (tenant_id) VALUES (${tenantId}::uuid) ON CONFLICT DO NOTHING`;
      const [state] = await tx.$queryRaw<Array<{ live: boolean }>>`SELECT coalesce(lease_until > clock_timestamp(), false) AS live
        FROM etl.tenant_load_state WHERE tenant_id = ${tenantId}::uuid FOR UPDATE`;
      if (!state || state.live) return null;
      // No live lease: recover every orphan, not only the run referenced by an expired reservation.
      const abandoned = await tx.$queryRaw<Array<{ id: string }>>`UPDATE etl.runs SET status = 'abandoned',
        finished_at = clock_timestamp(), error_code = 'BI_LEASE_LOST'
        WHERE tenant_id = ${tenantId}::uuid AND status = 'running' RETURNING id`;
      for (const run of abandoned) await this.clearStaging(tx, tenantId, run.id);
      await tx.$executeRaw`UPDATE etl.tenant_load_state SET lease_run_id = NULL, lease_token = NULL, lease_until = NULL
        WHERE tenant_id = ${tenantId}::uuid`;
      const now = await databaseTime(tx); const slot = hourUtc(now);
      await tx.$executeRaw`UPDATE etl.load_requests SET status = 'expired', finished_at = ${now}, error_code = 'BI_REQUEST_EXPIRED'
        WHERE tenant_id = ${tenantId}::uuid AND status = 'pending' AND expires_at <= ${now}`;
      await tx.$executeRaw`UPDATE etl.load_requests SET status = 'failed', finished_at = ${now}, error_code = 'BI_REQUEST_EXPIRED'
        WHERE tenant_id = ${tenantId}::uuid AND status = 'running' AND slot_at <> ${slot}`;
      const [request] = await tx.$queryRaw<Array<{ id: string; kind: 'manual' | 'retry'; status: string }>>`
        SELECT id, kind, status FROM etl.load_requests
        WHERE tenant_id = ${tenantId}::uuid AND status IN ('pending', 'running') AND slot_at = ${slot} FOR UPDATE`;
      const settings = await readSettings(tx, tenantId, now);
      const due = settings.scheduleEnabled && settings.nextScheduledAt !== null && Date.parse(settings.nextScheduledAt) <= now.getTime();
      if (!request && !due) return null;
      const [history] = await tx.$queryRaw<Array<{ succeeded: boolean; attempt: number }>>`
        SELECT coalesce(bool_or(status = 'succeeded'), false) AS succeeded, coalesce(max(attempt_no), 0)::int AS attempt
        FROM etl.runs WHERE tenant_id = ${tenantId}::uuid AND slot_at = ${slot}`;
      if (!history) throw new EtlError('BI_ETL_FAILED');
      if (history.succeeded || history.attempt >= 3) {
        if (request) await tx.$executeRaw`UPDATE etl.load_requests SET status = ${request.status === 'pending' ? 'skipped' : 'failed'},
          finished_at = ${now}, error_code = ${history.succeeded ? 'BI_ALREADY_SUCCEEDED' : 'BI_ATTEMPTS_EXHAUSTED'}
          WHERE tenant_id = ${tenantId}::uuid AND id = ${request.id}::uuid AND status IN ('pending', 'running')`;
        await this.advanceSchedule(tx, tenantId, now);
        return null;
      }
      if (request) {
        const changed = await tx.$executeRaw`UPDATE etl.load_requests SET status = 'running', started_at = coalesce(started_at, ${now})
          WHERE tenant_id = ${tenantId}::uuid AND id = ${request.id}::uuid AND status IN ('pending', 'running') AND expires_at > ${now}`;
        if (changed !== 1) throw new EtlError('BI_LEASE_LOST');
      }
      const runId = randomUUID(); const token = randomUUID(); const runOrigin: RunOrigin = request?.kind ?? origin;
      await tx.$executeRaw`INSERT INTO etl.runs (id, tenant_id, slot_at, attempt_no, started_at, request_id, origin, phase)
        VALUES (${runId}::uuid, ${tenantId}::uuid, ${slot}, ${history.attempt + 1}, ${now}, ${request?.id ?? null}::uuid,
          ${runOrigin}, 'extraction')`;
      await tx.$executeRaw`UPDATE etl.tenant_load_state SET lease_run_id = ${runId}::uuid, lease_token = ${token}::uuid,
        lease_until = clock_timestamp() + interval '90 seconds' WHERE tenant_id = ${tenantId}::uuid`;
      return { tenantId, runId, token, slot, deadline };
    });
  }

  protected override async extractionCompleted(tx: Prisma.TransactionClient, lease: Lease): Promise<void> {
    await tx.$executeRaw`UPDATE etl.runs SET extraction_completed_at = clock_timestamp(), phase = 'publication'
      WHERE tenant_id = ${lease.tenantId}::uuid AND id = ${lease.runId}::uuid AND status = 'running'`;
  }

  protected override async publicationCompleted(tx: Prisma.TransactionClient, lease: Lease): Promise<void> {
    const [run] = await tx.$queryRaw<Array<{ requestId: string | null }>>`SELECT request_id AS "requestId" FROM etl.runs
      WHERE tenant_id = ${lease.tenantId}::uuid AND id = ${lease.runId}::uuid`;
    if (run?.requestId) {
      const changed = await tx.$executeRaw`UPDATE etl.load_requests q SET status = 'succeeded', finished_at = r.finished_at, error_code = NULL
        FROM etl.runs r WHERE q.tenant_id = ${lease.tenantId}::uuid AND q.id = ${run.requestId}::uuid AND q.status = 'running'
          AND r.tenant_id = q.tenant_id AND r.id = ${lease.runId}::uuid AND r.request_id = q.id AND r.status = 'succeeded'`;
      if (changed !== 1) throw new EtlError('BI_LEASE_LOST');
    }
    await this.advanceSchedule(tx, lease.tenantId, await databaseTime(tx));
  }

  protected override async attemptFailed(tx: Prisma.TransactionClient, lease: Lease, code: string): Promise<void> {
    const now = await databaseTime(tx);
    const [run] = await tx.$queryRaw<Array<{ requestId: string | null; attempt: number }>>`
      SELECT request_id AS "requestId", attempt_no AS attempt FROM etl.runs
      WHERE tenant_id = ${lease.tenantId}::uuid AND id = ${lease.runId}::uuid`;
    if (!run) throw new EtlError('BI_LEASE_LOST');
    const terminal = run.attempt >= 3 || lease.slot.getTime() !== hourUtc(now).getTime() || code === 'BI_SLOT_CHANGED';
    if (terminal && run.requestId) await tx.$executeRaw`UPDATE etl.load_requests SET status = 'failed', finished_at = ${now}, error_code = ${code}
      WHERE tenant_id = ${lease.tenantId}::uuid AND id = ${run.requestId}::uuid AND status = 'running'`;
    if (terminal) await this.advanceSchedule(tx, lease.tenantId, now);
  }

  private async advanceSchedule(tx: Prisma.TransactionClient, tenantId: string, now: Date): Promise<void> {
    const settings = await readSettings(tx, tenantId, now);
    if (!settings.scheduleEnabled || settings.nextScheduledAt === null || Date.parse(settings.nextScheduledAt) > now.getTime()) return;
    // Preferences/version/updated_at belong to administrators; advancing the clock does not overwrite them.
    await tx.$executeRaw`UPDATE etl.tenant_settings SET next_scheduled_at = ${nextScheduledAt(now, settings.frequencyHours)}
      WHERE tenant_id = ${tenantId}::uuid AND schedule_enabled AND next_scheduled_at <= ${now}`;
  }
}
