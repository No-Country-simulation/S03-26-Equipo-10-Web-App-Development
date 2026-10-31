import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  STATISTICS_VERSION,
  StatisticsError,
  statisticsPayloadSchema,
  type StatisticsCode,
  type StatisticsLease,
  type StatisticsPayload,
} from '../statistics.types';

export class StatisticsJobRepository {
  private scanAfter: string | null = null;
  constructor(
    private readonly client: PrismaClient,
    private readonly eligible?: (tenantId: string) => Promise<boolean>,
  ) {}

  private transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.client.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL timezone = 'UTC'`;
        await tx.$executeRaw`SET LOCAL statement_timeout = '4s'`;
        await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
        await tx.$executeRaw`SET LOCAL transaction_timeout = '5s'`;
        return work(tx);
      },
      { maxWait: 1000, timeout: 5000 },
    );
  }

  /** Repairs a crash between ETL commit and enqueue; latest cuts only, bounded batches. */
  discover(): Promise<number> {
    return this.transaction(
      (tx) => tx.$executeRaw`
      INSERT INTO etl.statistics_jobs (tenant_id, source_run_id, algorithm_version, source_snapshot_at, source_snapshot_date_key)
      SELECT h.tenant_id, h.run_id, ${STATISTICS_VERSION}, h.snapshot_at, h.snapshot_date_key FROM (
        SELECT DISTINCT ON (tenant_id) tenant_id, run_id, snapshot_at, snapshot_date_key
        FROM dw.fact_tenant_snapshot ORDER BY tenant_id, snapshot_at DESC, run_id) h
      JOIN dw.statistics_history_state s ON s.tenant_id = h.tenant_id AND s.creations_through_run_id = h.run_id
      WHERE NOT EXISTS(SELECT 1 FROM etl.statistics_jobs j WHERE j.tenant_id = h.tenant_id
        AND j.source_run_id = h.run_id AND j.algorithm_version = ${STATISTICS_VERSION})
      ORDER BY h.tenant_id LIMIT 1000 ON CONFLICT DO NOTHING`,
    );
  }

  async claim(): Promise<StatisticsLease | null> {
    const candidates = await this.transaction(
      (tx) => tx.$queryRaw<Array<{ tenantId: string }>>`
      SELECT tenant_id AS "tenantId" FROM etl.statistics_jobs WHERE algorithm_version = ${STATISTICS_VERSION}
        AND (${this.eligible ? this.scanAfter : null}::uuid IS NULL OR tenant_id>${this.eligible ? this.scanAfter : null}::uuid)
        AND ((status IN ('pending', 'failed') AND attempt_count < 3)
          OR (status = 'running' AND (lease_until <= clock_timestamp() OR deadline_at <= clock_timestamp())))
      GROUP BY tenant_id ORDER BY ${this.eligible ? Prisma.sql`tenant_id` : Prisma.sql`min(created_at),tenant_id`} LIMIT 100`,
    );
    if (!candidates.length) this.scanAfter = null;
    for (const { tenantId } of candidates) {
      if (this.eligible) {
        this.scanAfter = tenantId;
        if (!(await this.eligible(tenantId))) continue;
      }
      const claimed = await this.transaction(async (tx) => {
        const [lock] = await tx.$queryRaw<Array<{ locked: boolean }>>`
          SELECT pg_try_advisory_xact_lock(hashtextextended(${tenantId}::uuid::text, 543005)) AS locked`;
        if (!lock?.locked) return null;
        await tx.$executeRaw`UPDATE etl.statistics_jobs SET status = 'failed', finished_at = clock_timestamp(),
          lease_token = NULL, lease_until = NULL, deadline_at = NULL, error_code = 'BI_STATISTICS_LEASE_LOST'
          WHERE tenant_id = ${tenantId}::uuid AND algorithm_version = ${STATISTICS_VERSION} AND status = 'running'
            AND (lease_until <= clock_timestamp() OR deadline_at <= clock_timestamp())`;
        const [live] = await tx.$queryRaw<
          Array<{ active: boolean }>
        >`SELECT EXISTS(
          SELECT 1 FROM etl.statistics_jobs WHERE tenant_id = ${tenantId}::uuid AND status = 'running') AS active`;
        if (live?.active) return null;
        const [latest] = await tx.$queryRaw<
          Array<{ runId: string; at: Date; date: string }>
        >`
          SELECT h.run_id AS "runId", h.snapshot_at AS at, h.snapshot_date_key::text AS date FROM dw.fact_tenant_snapshot h
          WHERE h.tenant_id = ${tenantId}::uuid ORDER BY h.snapshot_at DESC, h.run_id LIMIT 1`;
        if (!latest) return null;
        await tx.$executeRaw`UPDATE etl.statistics_jobs SET status = 'superseded', finished_at = clock_timestamp(), error_code = NULL
          WHERE tenant_id = ${tenantId}::uuid AND algorithm_version = ${STATISTICS_VERSION}
            AND source_run_id <> ${latest.runId}::uuid AND status IN ('pending', 'failed')`;
        const [initialized] = await tx.$queryRaw<
          Array<{ ready: boolean }>
        >`SELECT EXISTS(SELECT 1 FROM dw.statistics_history_state
          WHERE tenant_id = ${tenantId}::uuid AND creations_through_run_id = ${latest.runId}::uuid) AS ready`;
        if (!initialized?.ready) return null;
        await tx.$executeRaw`INSERT INTO etl.statistics_jobs
          (tenant_id, source_run_id, algorithm_version, source_snapshot_at, source_snapshot_date_key)
          VALUES (${tenantId}::uuid, ${latest.runId}::uuid, ${STATISTICS_VERSION}, ${latest.at}, ${latest.date}::date)
          ON CONFLICT DO NOTHING`;
        const token = randomUUID();
        const [job] = await tx.$queryRaw<Array<{ remaining: number }>>`
          WITH instant AS (SELECT date_trunc('milliseconds', clock_timestamp()) AS at)
          UPDATE etl.statistics_jobs j SET status = 'running', attempt_count = attempt_count + 1,
            claimed_at = greatest(t.at, j.created_at), finished_at = NULL, lease_token = ${token}::uuid,
            lease_until = greatest(t.at, j.created_at) + interval '90 seconds',
            deadline_at = greatest(t.at, j.created_at) + interval '60 seconds', error_code = NULL
          FROM instant t WHERE j.tenant_id = ${tenantId}::uuid AND j.source_run_id = ${latest.runId}::uuid
            AND j.algorithm_version = ${STATISTICS_VERSION} AND j.status IN ('pending', 'failed') AND j.attempt_count < 3
          RETURNING greatest(0, extract(epoch FROM (deadline_at - clock_timestamp())) * 1000)::float8 AS remaining`;
        return job
          ? {
              tenantId,
              sourceRunId: latest.runId,
              sourceSnapshotAt: latest.at,
              token,
              deadline: Date.now() + Math.min(60000, job.remaining),
            }
          : null;
      });
      if (claimed) {
        this.scanAfter = null;
        return claimed;
      }
    }
    return null;
  }

  /** Pause a fenced claim without exhausting retries while the plan is suspended. */
  defer(lease: StatisticsLease): Promise<number> {
    return this.transaction(
      (tx) => tx.$executeRaw`UPDATE etl.statistics_jobs
      SET status=CASE WHEN attempt_count=1 THEN 'pending' ELSE 'failed' END,
        claimed_at=CASE WHEN attempt_count=1 THEN NULL ELSE claimed_at END,
        finished_at=CASE WHEN attempt_count=1 THEN NULL ELSE clock_timestamp() END,
        error_code=CASE WHEN attempt_count=1 THEN NULL ELSE 'BI_STATISTICS_FAILED' END,
        attempt_count=greatest(0,attempt_count-1),lease_token=NULL,lease_until=NULL,deadline_at=NULL
      WHERE tenant_id=${lease.tenantId}::uuid AND source_run_id=${lease.sourceRunId}::uuid
        AND algorithm_version=${STATISTICS_VERSION} AND status='running' AND lease_token=${lease.token}::uuid
        AND lease_until>clock_timestamp() AND deadline_at>clock_timestamp()`,
    );
  }

  heartbeat(lease: StatisticsLease): Promise<boolean> {
    return this.transaction(
      async (tx) =>
        (await tx.$executeRaw`UPDATE etl.statistics_jobs
      SET lease_until = least(deadline_at, clock_timestamp() + interval '90 seconds')
      WHERE tenant_id = ${lease.tenantId}::uuid AND source_run_id = ${lease.sourceRunId}::uuid AND algorithm_version = ${STATISTICS_VERSION}
        AND status = 'running' AND lease_token = ${lease.token}::uuid
        AND lease_until > clock_timestamp() AND deadline_at > clock_timestamp()`) ===
        1,
    );
  }

  succeeded(lease: StatisticsLease): Promise<boolean> {
    return this.transaction(async (tx) => {
      const [row] = await tx.$queryRaw<
        Array<{ complete: boolean }>
      >`SELECT EXISTS(SELECT 1 FROM etl.statistics_jobs j
        JOIN dw.statistics_publication p ON p.tenant_id = j.tenant_id AND p.source_run_id = j.source_run_id AND p.algorithm_version = j.algorithm_version
        WHERE j.tenant_id = ${lease.tenantId}::uuid AND j.source_run_id = ${lease.sourceRunId}::uuid
          AND j.algorithm_version = ${STATISTICS_VERSION} AND j.status = 'succeeded') AS complete`;
      return row?.complete === true;
    });
  }

  async publish(
    lease: StatisticsLease,
    payload: StatisticsPayload,
  ): Promise<'succeeded' | 'superseded'> {
    const validated = statisticsPayloadSchema.safeParse(payload);
    if (!validated.success)
      throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
    const nextMonth = new Date(lease.sourceSnapshotAt);
    nextMonth.setUTCDate(1);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    if (
      validated.data.anomalies.to !==
        lease.sourceSnapshotAt.toISOString().slice(0, 10) ||
      validated.data.forecast.targetMonth !==
        nextMonth.toISOString().slice(0, 7)
    )
      throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
    const serialized = JSON.stringify(validated.data);
    return this.transaction(async (tx) => {
      const [job] = await tx.$queryRaw<
        Array<{ live: boolean; status: string; at: Date }>
      >`SELECT status, source_snapshot_at AS at,
        (lease_token = ${lease.token}::uuid AND lease_until > clock_timestamp() AND deadline_at > clock_timestamp()) AS live
        FROM etl.statistics_jobs WHERE tenant_id = ${lease.tenantId}::uuid AND source_run_id = ${lease.sourceRunId}::uuid
          AND algorithm_version = ${STATISTICS_VERSION} FOR UPDATE`;
      if (job?.status === 'succeeded') {
        const [row] = await tx.$queryRaw<
          Array<{ exists: boolean }>
        >`SELECT EXISTS(SELECT 1 FROM dw.statistics_publication
          WHERE tenant_id = ${lease.tenantId}::uuid AND source_run_id = ${lease.sourceRunId}::uuid AND algorithm_version = ${STATISTICS_VERSION}) AS exists`;
        if (row?.exists) return 'succeeded';
        throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
      }
      if (job?.status !== 'running' || !job.live)
        throw new StatisticsError('BI_STATISTICS_LEASE_LOST');
      if (job.at.getTime() !== lease.sourceSnapshotAt.getTime())
        throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lease.tenantId}::uuid::text || ${STATISTICS_VERSION}, 543006))`;
      const [current] = await tx.$queryRaw<
        Array<{ at: Date }>
      >`SELECT p.source_snapshot_at AS at FROM dw.statistics_current c
        JOIN dw.statistics_publication p ON p.tenant_id = c.tenant_id AND p.algorithm_version = c.algorithm_version AND p.source_run_id = c.source_run_id
        WHERE c.tenant_id = ${lease.tenantId}::uuid AND c.algorithm_version = ${STATISTICS_VERSION} FOR UPDATE OF c`;
      if (current && current.at >= lease.sourceSnapshotAt) {
        const changed =
          await tx.$executeRaw`UPDATE etl.statistics_jobs SET status = 'superseded', finished_at = clock_timestamp(),
          lease_token = NULL, lease_until = NULL, deadline_at = NULL, error_code = NULL
          WHERE tenant_id = ${lease.tenantId}::uuid AND source_run_id = ${lease.sourceRunId}::uuid AND algorithm_version = ${STATISTICS_VERSION}
            AND status = 'running' AND lease_token = ${lease.token}::uuid AND lease_until > clock_timestamp() AND deadline_at > clock_timestamp()`;
        if (changed !== 1)
          throw new StatisticsError('BI_STATISTICS_LEASE_LOST');
        return 'superseded';
      }
      await tx.$executeRaw`INSERT INTO dw.statistics_publication
        (tenant_id, source_run_id, algorithm_version, source_snapshot_at, source_snapshot_date_key, payload)
        SELECT tenant_id, source_run_id, algorithm_version, source_snapshot_at, source_snapshot_date_key, ${serialized}::jsonb
        FROM etl.statistics_jobs WHERE tenant_id = ${lease.tenantId}::uuid AND source_run_id = ${lease.sourceRunId}::uuid
          AND algorithm_version = ${STATISTICS_VERSION} AND source_snapshot_at = ${lease.sourceSnapshotAt}`;
      await tx.$executeRaw`INSERT INTO dw.statistics_current (tenant_id, algorithm_version, source_run_id)
        VALUES (${lease.tenantId}::uuid, ${STATISTICS_VERSION}, ${lease.sourceRunId}::uuid)
        ON CONFLICT (tenant_id, algorithm_version) DO UPDATE SET source_run_id = excluded.source_run_id`;
      const changed =
        await tx.$executeRaw`UPDATE etl.statistics_jobs SET status = 'succeeded', finished_at = clock_timestamp(),
        lease_token = NULL, lease_until = NULL, deadline_at = NULL, error_code = NULL
        WHERE tenant_id = ${lease.tenantId}::uuid AND source_run_id = ${lease.sourceRunId}::uuid AND algorithm_version = ${STATISTICS_VERSION}
          AND status = 'running' AND lease_token = ${lease.token}::uuid AND lease_until > clock_timestamp() AND deadline_at > clock_timestamp()`;
      if (changed !== 1) throw new StatisticsError('BI_STATISTICS_LEASE_LOST');
      if (Date.now() >= lease.deadline)
        throw new StatisticsError('BI_STATISTICS_DEADLINE_EXCEEDED');
      return 'succeeded';
    });
  }

  fail(lease: StatisticsLease, code: StatisticsCode): Promise<number> {
    return this.transaction(
      (
        tx,
      ) => tx.$executeRaw`UPDATE etl.statistics_jobs SET status = 'failed', finished_at = clock_timestamp(),
      lease_token = NULL, lease_until = NULL, deadline_at = NULL, error_code = ${code}
      WHERE tenant_id = ${lease.tenantId}::uuid AND source_run_id = ${lease.sourceRunId}::uuid
        AND algorithm_version = ${STATISTICS_VERSION} AND status = 'running' AND lease_token = ${lease.token}::uuid`,
    );
  }
}
