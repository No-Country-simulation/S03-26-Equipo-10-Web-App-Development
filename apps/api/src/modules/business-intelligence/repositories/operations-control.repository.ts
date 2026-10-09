import { createHash, timingSafeEqual } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { NotFoundError, UnavailableError } from '../../../common/errors/application.error';
import { hourUtc } from '../etl.types';
import { BiOperationsError, idempotencyKeySchema, loadRequestInputSchema, operationIdentitySchema, settingsPatchSchema,
  type OperationIdentity, type LoadRequestInput, type SettingsPatch } from '../operations.types';
import type { ControlTransactions } from './bi-control-connection';
import { databaseTime, findRequest, lockOperationsTenant, readSettings } from './operations-records';

/** Tenant-serialized durable control. HTTP authorization belongs to the transport boundary. */
export class OperationsControlRepository {
  constructor(private readonly connection: ControlTransactions) {}

  async updateSettings(identity: OperationIdentity, input: SettingsPatch) {
    const { tenantId, actorId } = operationIdentitySchema.parse(identity);
    const patch = settingsPatchSchema.parse(input);
    return this.connection.write(async tx => {
      await lockOperationsTenant(tx, tenantId);
      const now = await databaseTime(tx); const before = await readSettings(tx, tenantId, now);
      if (before.version !== patch.expectedVersion) throw new BiOperationsError('BI_SETTINGS_CONFLICT');
      const frequency = patch.frequencyHours ?? before.frequencyHours;
      const enabled = patch.scheduleEnabled ?? before.scheduleEnabled;
      // Alert edits keep the schedule. First configuration, resume and cadence changes observe the current hour.
      const reschedule = before.version === 0 || !before.scheduleEnabled || frequency !== before.frequencyHours;
      const next = enabled ? (reschedule ? hourUtc(now).toISOString() : before.nextScheduledAt) : null;
      await tx.$executeRaw`INSERT INTO etl.tenant_settings
        (tenant_id, frequency_hours, schedule_enabled, next_scheduled_at, alert_failures, alert_delays, delay_tolerance_minutes, version, updated_at)
        VALUES (${tenantId}::uuid, ${frequency}, ${enabled}, ${next}::timestamptz,
          ${patch.alertFailures ?? before.alertFailures}, ${patch.alertDelays ?? before.alertDelays},
          ${patch.delayToleranceMinutes ?? before.delayToleranceMinutes}, ${before.version + 1}, ${now})
        ON CONFLICT (tenant_id) DO UPDATE SET frequency_hours = excluded.frequency_hours,
          schedule_enabled = excluded.schedule_enabled, next_scheduled_at = excluded.next_scheduled_at,
          alert_failures = excluded.alert_failures, alert_delays = excluded.alert_delays,
          delay_tolerance_minutes = excluded.delay_tolerance_minutes, version = excluded.version, updated_at = excluded.updated_at`;
      const after = await readSettings(tx, tenantId, now);
      await tx.$executeRaw`INSERT INTO etl.control_audit (tenant_id, actor_id, action, settings_before, settings_after)
        VALUES (${tenantId}::uuid, ${actorId}::uuid, 'settings_updated', ${JSON.stringify(before)}::jsonb, ${JSON.stringify(after)}::jsonb)`;
      return after;
    });
  }

  async createRequest(identity: OperationIdentity, key: string, input: LoadRequestInput, requireLiveWorker = false) {
    const { tenantId, actorId } = operationIdentitySchema.parse(identity);
    const idempotencyKey = idempotencyKeySchema.parse(key); const value = loadRequestInputSchema.parse(input);
    const hash = createHash('sha256').update(JSON.stringify([value.kind, value.retryOfRunId ?? null])).digest('hex');
    return this.connection.write(async tx => {
      await lockOperationsTenant(tx, tenantId);
      const [existing] = await tx.$queryRaw<Array<{ id: string; hash: string }>>`
        SELECT id, payload_hash AS hash FROM etl.load_requests
        WHERE tenant_id = ${tenantId}::uuid AND actor_id = ${actorId}::uuid AND idempotency_key = ${idempotencyKey}`;
      if (existing) {
        if (!timingSafeEqual(Buffer.from(existing.hash), Buffer.from(hash))) throw new BiOperationsError('IDEMPOTENCY_KEY_REUSED');
        return { request: await this.requiredRequest(tx, tenantId, existing.id), replayed: true };
      }
      const now = await databaseTime(tx); const slot = hourUtc(now);
      if (value.retryOfRunId) {
        const [run] = await tx.$queryRaw<Array<{ status: string }>>`SELECT status FROM etl.runs
          WHERE tenant_id = ${tenantId}::uuid AND id = ${value.retryOfRunId}::uuid`;
        if (!run) throw new NotFoundError('BI run not found');
        if (!['failed', 'abandoned'].includes(run.status)) throw new BiOperationsError('BI_RETRY_NOT_ALLOWED');
      }
      // Expire only pending requests; an expired active worker must be recovered by the ETL.
      await tx.$executeRaw`UPDATE etl.load_requests SET status = 'expired', finished_at = ${now}, error_code = 'BI_REQUEST_EXPIRED'
        WHERE tenant_id = ${tenantId}::uuid AND status = 'pending' AND expires_at <= ${now}`;
      const [state] = await tx.$queryRaw<Array<{ runId: string | null; live: boolean }>>`SELECT lease_run_id AS "runId",
        coalesce(lease_until > ${now}, false) AS live FROM etl.tenant_load_state WHERE tenant_id = ${tenantId}::uuid`;
      if (state?.runId) throw new BiOperationsError(state.live ? 'BI_ALREADY_RUNNING' : 'BI_RECOVERY_REQUIRED');
      const [active] = await tx.$queryRaw<Array<{ exists: boolean; running: boolean }>>`SELECT
        EXISTS(SELECT 1 FROM etl.load_requests WHERE tenant_id = ${tenantId}::uuid AND status IN ('pending', 'running')) AS exists,
        EXISTS(SELECT 1 FROM etl.runs WHERE tenant_id = ${tenantId}::uuid AND status = 'running') AS running`;
      if (active?.running) throw new BiOperationsError('BI_RECOVERY_REQUIRED');
      if (active?.exists) throw new BiOperationsError('BI_REQUEST_CONFLICT');
      const [history] = await tx.$queryRaw<Array<{ succeeded: boolean; attempts: number }>>`
        SELECT coalesce(bool_or(status = 'succeeded'), false) AS succeeded, coalesce(max(attempt_no), 0)::int AS attempts
        FROM etl.runs WHERE tenant_id = ${tenantId}::uuid AND slot_at = ${slot}`;
      if (history?.succeeded) throw new BiOperationsError('BI_ALREADY_SUCCEEDED');
      if (history && history.attempts >= 3) throw new BiOperationsError('BI_ATTEMPTS_EXHAUSTED');
      // Only new HTTP requests require a live, compatible worker. Durable replays above always survive outages.
      if (requireLiveWorker) {
        const [health] = await tx.$queryRaw<Array<{ live: boolean }>>`SELECT EXISTS(SELECT 1 FROM etl.worker_health
          WHERE protocol_version = 1 AND NOT stopping AND last_seen_at > ${now} - interval '60 seconds') AS live`;
        if (!health?.live) throw new UnavailableError('El servicio de cargas no está disponible', 'BI_WORKER_UNAVAILABLE');
      }
      const [created] = await tx.$queryRaw<Array<{ id: string }>>`INSERT INTO etl.load_requests
        (tenant_id, actor_id, kind, retry_of_run_id, idempotency_key, payload_hash, slot_at, expires_at, created_at)
        VALUES (${tenantId}::uuid, ${actorId}::uuid, ${value.kind}, ${value.retryOfRunId ?? null}::uuid,
          ${idempotencyKey}, ${hash}, ${slot}, ${new Date(slot.getTime() + 3600000)}, ${now}) RETURNING id`;
      if (!created) throw new Error('BI_REQUEST_NOT_CREATED');
      await tx.$executeRaw`INSERT INTO etl.control_audit (tenant_id, actor_id, action, request_id)
        VALUES (${tenantId}::uuid, ${actorId}::uuid, 'request_created', ${created.id}::uuid)`;
      return { request: await this.requiredRequest(tx, tenantId, created.id), replayed: false };
    });
  }

  async cancelRequest(identity: OperationIdentity, requestId: string, key: string) {
    const { tenantId, actorId } = operationIdentitySchema.parse(identity);
    const id = operationIdentitySchema.shape.tenantId.parse(requestId).toLowerCase(); const idempotencyKey = idempotencyKeySchema.parse(key);
    return this.connection.write(async tx => {
      await lockOperationsTenant(tx, tenantId);
      const [previous] = await tx.$queryRaw<Array<{ requestId: string }>>`SELECT request_id AS "requestId" FROM etl.control_audit
        WHERE tenant_id = ${tenantId}::uuid AND actor_id = ${actorId}::uuid AND action = 'request_cancelled' AND idempotency_key = ${idempotencyKey}`;
      if (previous) {
        if (previous.requestId !== id) throw new BiOperationsError('IDEMPOTENCY_KEY_REUSED');
        return this.requiredRequest(tx, tenantId, id);
      }
      const request = await this.requiredRequest(tx, tenantId, id); const now = await databaseTime(tx);
      if (request.status !== 'pending' || Date.parse(request.expiresAt) <= now.getTime()) throw new BiOperationsError('BI_REQUEST_NOT_PENDING');
      const changed = await tx.$executeRaw`UPDATE etl.load_requests SET status = 'cancelled', finished_at = ${now}
        WHERE tenant_id = ${tenantId}::uuid AND id = ${id}::uuid AND status = 'pending' AND expires_at > ${now}`;
      if (changed !== 1) throw new BiOperationsError('BI_REQUEST_NOT_PENDING');
      await tx.$executeRaw`INSERT INTO etl.control_audit (tenant_id, actor_id, action, request_id, idempotency_key)
        VALUES (${tenantId}::uuid, ${actorId}::uuid, 'request_cancelled', ${id}::uuid, ${idempotencyKey})`;
      return this.requiredRequest(tx, tenantId, id);
    });
  }

  private async requiredRequest(tx: Prisma.TransactionClient, tenantId: string, id: string) {
    const request = await findRequest(tx, tenantId, id);
    if (!request) throw new NotFoundError('BI request not found');
    return request;
  }
}
