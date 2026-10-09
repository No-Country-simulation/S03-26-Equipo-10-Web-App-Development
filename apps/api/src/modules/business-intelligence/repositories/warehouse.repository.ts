import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { EtlError, type CategoryRow, type Counts, type EventRow, type Lease,
  type SourceSnapshot, type TestimonialRow } from '../etl.types';

interface State { leaseRunId: string | null; token: string | null; live: boolean; lastPublishedRunId: string | null }

export class WarehouseRepository {
  readonly operations: boolean = false;
  constructor(protected readonly client: PrismaClient) {}

  protected transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>, deadline = Date.now() + 35000): Promise<T> {
    const remaining = Math.min(35000, Math.floor(deadline - Date.now()));
    if (remaining <= 0) return Promise.reject(new EtlError('BI_DEADLINE_EXCEEDED'));
    return this.client.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL timezone = 'UTC'`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '30s'`;
      await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
      await tx.$queryRaw`SELECT set_config('transaction_timeout', ${`${remaining}ms`}, true)`;
      return work(tx);
    }, { maxWait: 5000, timeout: remaining });
  }

  async claim(tenantId: string, slot: Date, _origin: 'scheduled' | 'cli' = 'scheduled'): Promise<Lease | null> {
    const deadline = Date.now() + 300000;
    return this.transaction(async tx => {
      await tx.$executeRaw`INSERT INTO etl.tenant_load_state (tenant_id) VALUES (${tenantId}::uuid) ON CONFLICT DO NOTHING`;
      const [state] = await tx.$queryRaw<State[]>`
        SELECT lease_run_id AS "leaseRunId", lease_token AS token,
          coalesce(lease_until > clock_timestamp(), false) AS live, last_published_run_id AS "lastPublishedRunId"
        FROM etl.tenant_load_state WHERE tenant_id = ${tenantId}::uuid FOR UPDATE`;
      if (!state || state.live) return null;
      if (state.leaseRunId) {
        await tx.$executeRaw`UPDATE etl.runs SET status = 'abandoned', finished_at = clock_timestamp(), error_code = 'BI_LEASE_LOST'
          WHERE tenant_id = ${tenantId}::uuid AND id = ${state.leaseRunId}::uuid AND status = 'running'`;
        await this.clearStaging(tx, tenantId, state.leaseRunId);
        await tx.$executeRaw`UPDATE etl.tenant_load_state SET lease_run_id = NULL, lease_token = NULL, lease_until = NULL
          WHERE tenant_id = ${tenantId}::uuid`;
      }
      const [history] = await tx.$queryRaw<Array<{ succeeded: boolean; attempt: number }>>`
        SELECT coalesce(bool_or(status = 'succeeded'), false) AS succeeded, coalesce(max(attempt_no), 0)::int AS attempt
        FROM etl.runs WHERE tenant_id = ${tenantId}::uuid AND slot_at = ${slot}`;
      if (!history || history.succeeded || history.attempt >= 3) return null;
      const runId = randomUUID();
      const token = randomUUID();
      await tx.$executeRaw`INSERT INTO etl.runs (id, tenant_id, slot_at, attempt_no)
        VALUES (${runId}::uuid, ${tenantId}::uuid, ${slot}, ${history.attempt + 1})`;
      await tx.$executeRaw`UPDATE etl.tenant_load_state SET lease_run_id = ${runId}::uuid, lease_token = ${token}::uuid,
        lease_until = clock_timestamp() + interval '90 seconds' WHERE tenant_id = ${tenantId}::uuid`;
      return { tenantId, runId, token, slot, deadline };
    });
  }

  async heartbeat(lease: Lease): Promise<boolean> {
    return this.transaction(async tx => (await tx.$executeRaw`
      UPDATE etl.tenant_load_state SET lease_until = clock_timestamp() + interval '90 seconds'
      WHERE tenant_id = ${lease.tenantId}::uuid AND lease_run_id = ${lease.runId}::uuid
        AND lease_token = ${lease.token}::uuid AND lease_until > clock_timestamp()`) === 1, lease.deadline);
  }

  protected async lockTenant(_tx: Prisma.TransactionClient, _tenantId: string): Promise<void> {}
  protected async extractionCompleted(_tx: Prisma.TransactionClient, _lease: Lease): Promise<void> {}
  protected async publicationCompleted(_tx: Prisma.TransactionClient, _lease: Lease): Promise<void> {}
  protected async attemptFailed(_tx: Prisma.TransactionClient, _lease: Lease, _code: string): Promise<void> {}

  protected async fence(tx: Prisma.TransactionClient, lease: Lease): Promise<void> {
    if (Date.now() >= lease.deadline) throw new EtlError('BI_DEADLINE_EXCEEDED');
    await this.lockTenant(tx, lease.tenantId);
    const [state] = await tx.$queryRaw<Array<{ live: boolean }>>`
      SELECT lease_until > clock_timestamp() AS live FROM etl.tenant_load_state
      WHERE tenant_id = ${lease.tenantId}::uuid AND lease_run_id = ${lease.runId}::uuid
        AND lease_token = ${lease.token}::uuid FOR UPDATE`;
    if (!state?.live) throw new EtlError('BI_LEASE_LOST');
    const [run] = await tx.$queryRaw<Array<{ status: string }>>`
      SELECT status FROM etl.runs WHERE tenant_id = ${lease.tenantId}::uuid AND id = ${lease.runId}::uuid`;
    if (run?.status !== 'running') throw new EtlError('BI_LEASE_LOST');
  }

  async snapshot(lease: Lease, snapshot: SourceSnapshot): Promise<void> {
    await this.transaction(async tx => {
      await this.fence(tx, lease);
      await tx.$executeRaw`UPDATE etl.runs SET source_snapshot_at = ${snapshot.at}
        WHERE tenant_id = ${lease.tenantId}::uuid AND id = ${lease.runId}::uuid AND status = 'running'`;
    }, lease.deadline);
  }

  /** Persist known source totals separately so a rolled-back publication remains diagnosable. */
  async extracted(lease: Lease, counts: Counts): Promise<void> {
    await this.transaction(async tx => {
      await this.fence(tx, lease);
      await tx.$executeRaw`UPDATE etl.runs SET source_category_count = ${counts.categories},
        source_testimonial_count = ${counts.testimonials}, source_event_count = ${counts.events}
        WHERE tenant_id = ${lease.tenantId}::uuid AND id = ${lease.runId}::uuid AND status = 'running'`;
      await this.extractionCompleted(tx, lease);
    }, lease.deadline);
  }

  private async stage(lease: Lease, work: (tx: Prisma.TransactionClient) => Promise<unknown>): Promise<void> {
    try {
      await this.transaction(async tx => { await this.fence(tx, lease); await work(tx); }, lease.deadline);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010'
        && ['23502', '23503', '23505', '23514'].includes(String(error.meta?.code))) {
        throw new EtlError('BI_SOURCE_INCONSISTENT');
      }
      throw error;
    }
  }

  async categories(lease: Lease, rows: CategoryRow[]): Promise<void> {
    if (rows.some(row => row.tenantId !== lease.tenantId)) throw new EtlError('BI_SOURCE_INCONSISTENT');
    const data = JSON.stringify(rows.map(row => ({ id: row.categoryId, name: row.name })));
    await this.stage(lease, tx => tx.$executeRaw`
      INSERT INTO staging.categories (tenant_id, run_id, category_id, name)
      SELECT ${lease.tenantId}::uuid, ${lease.runId}::uuid, x.id, x.name
      FROM jsonb_to_recordset(${data}::jsonb) AS x(id uuid, name text)`);
  }

  async testimonials(lease: Lease, rows: TestimonialRow[]): Promise<void> {
    if (rows.some(row => row.tenantId !== lease.tenantId || !row.statusCode)) throw new EtlError('BI_SOURCE_INCONSISTENT');
    const data = JSON.stringify(rows.map(row => ({ id: row.testimonialId, category: row.categoryId,
      status: row.statusCode, rating: row.rating, score: row.score.toString(), created: row.createdAt,
      published: row.publishedAt, image: row.hasImage, video: row.hasVideo })));
    await this.stage(lease, tx => tx.$executeRaw`
      INSERT INTO staging.testimonials (tenant_id, run_id, testimonial_id, category_id, status_code,
        rating, score, created_at, published_at, has_image, has_video)
      SELECT ${lease.tenantId}::uuid, ${lease.runId}::uuid, x.id, x.category, x.status,
        x.rating, x.score, x.created, x.published, x.image, x.video
      FROM jsonb_to_recordset(${data}::jsonb) AS x(id uuid, category uuid, status text,
        rating smallint, score numeric(10,4), created timestamptz(3), published timestamptz(3), image boolean, video boolean)`);
  }

  async events(lease: Lease, rows: EventRow[]): Promise<void> {
    if (rows.some(row => row.tenantId !== lease.tenantId || !row.eventTypeCode)) throw new EtlError('BI_SOURCE_INCONSISTENT');
    const data = JSON.stringify(rows.map(row => ({ id: row.eventId.toString(), testimonial: row.testimonialId,
      type: row.eventTypeCode, source: row.sourceCode, created: row.createdAt })));
    await this.stage(lease, tx => tx.$executeRaw`
      INSERT INTO staging.analytics_events (tenant_id, run_id, event_id, testimonial_id, event_type_code, source_code, created_at)
      SELECT ${lease.tenantId}::uuid, ${lease.runId}::uuid, x.id, x.testimonial, x.type, x.source, x.created
      FROM jsonb_to_recordset(${data}::jsonb) AS x(id bigint, testimonial uuid, type text, source text, created timestamptz(3))`);
  }

  async publish(lease: Lease, snapshot: SourceSnapshot, counts: Counts): Promise<void> {
    await this.transaction(async tx => {
      await this.fence(tx, lease);
      const [valid] = await tx.$queryRaw<Array<{ categories: bigint; testimonials: bigint; events: bigint; future: boolean; newer: boolean; recorded: boolean }>>`
        SELECT (SELECT count(*) FROM staging.categories WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid) AS categories,
          (SELECT count(*) FROM staging.testimonials WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid) AS testimonials,
          (SELECT count(*) FROM staging.analytics_events WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid) AS events,
          (EXISTS(SELECT 1 FROM staging.testimonials WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid
            AND (created_at > ${snapshot.at} OR published_at > ${snapshot.at}))
           OR EXISTS(SELECT 1 FROM staging.analytics_events WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid
            AND created_at > ${snapshot.at})) AS future,
          NOT EXISTS(SELECT 1 FROM etl.tenant_load_state s JOIN etl.runs r
            ON r.tenant_id = s.tenant_id AND r.id = s.last_published_run_id
            WHERE s.tenant_id = ${lease.tenantId}::uuid AND r.source_snapshot_at >= ${snapshot.at}) AS newer,
          EXISTS(SELECT 1 FROM etl.runs WHERE tenant_id = ${lease.tenantId}::uuid AND id = ${lease.runId}::uuid
            AND status = 'running' AND source_snapshot_at = ${snapshot.at}) AS recorded`;
      if (!valid || valid.future || valid.categories !== counts.categories || valid.testimonials !== counts.testimonials
        || valid.events !== counts.events || !valid.recorded || snapshot.tenantId !== lease.tenantId) throw new EtlError('BI_SOURCE_INCONSISTENT');
      if (!valid.newer) throw new EtlError('BI_SOURCE_NOT_NEWER');

      await tx.$executeRaw`INSERT INTO dw.dim_tenant (tenant_id, name, is_active)
        VALUES (${lease.tenantId}::uuid, ${snapshot.name}, ${snapshot.isActive}) ON CONFLICT (tenant_id)
        DO UPDATE SET name = excluded.name, is_active = excluded.is_active, updated_at = clock_timestamp()`;
      await tx.$executeRaw`UPDATE dw.dim_testimonial SET is_present = false WHERE tenant_id = ${lease.tenantId}::uuid`;
      await tx.$executeRaw`INSERT INTO dw.dim_testimonial (tenant_id, testimonial_id)
        SELECT tenant_id, testimonial_id FROM staging.testimonials WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid
        ON CONFLICT (tenant_id, testimonial_id) DO UPDATE SET is_present = true`;
      await tx.$executeRaw`UPDATE dw.dim_category SET is_present = false
        WHERE tenant_id = ${lease.tenantId}::uuid AND source_category_id IS NOT NULL`;
      await tx.$executeRaw`INSERT INTO dw.dim_category (tenant_id, source_category_id, name)
        VALUES (${lease.tenantId}::uuid, NULL, 'Sin categoría')
        ON CONFLICT (tenant_id, source_category_id) DO UPDATE SET is_present = true`;
      await tx.$executeRaw`INSERT INTO dw.dim_category (tenant_id, source_category_id, name)
        SELECT tenant_id, category_id, name FROM staging.categories WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid
        ON CONFLICT (tenant_id, source_category_id) DO UPDATE SET name = excluded.name, is_present = true`;
      await tx.$executeRaw`INSERT INTO dw.dim_status (status_code)
        SELECT DISTINCT status_code FROM staging.testimonials WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid
        ON CONFLICT DO NOTHING`;
      await tx.$executeRaw`INSERT INTO dw.dim_event_type (code)
        SELECT DISTINCT event_type_code FROM staging.analytics_events WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid
        ON CONFLICT DO NOTHING`;
      await tx.$executeRaw`INSERT INTO dw.dim_source (tenant_id, code)
        SELECT DISTINCT tenant_id, source_code FROM staging.analytics_events WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid
        ON CONFLICT DO NOTHING`;
      await tx.$executeRaw`INSERT INTO dw.dim_date (date_key)
        SELECT DISTINCT (created_at AT TIME ZONE 'UTC')::date FROM staging.analytics_events
        WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid
        UNION SELECT (${snapshot.at} AT TIME ZONE 'UTC')::date ON CONFLICT DO NOTHING`;
      // The initial publication time is private to this transaction; completion replaces it below.
      await tx.$executeRaw`INSERT INTO dw.fact_tenant_snapshot
        (tenant_id, run_id, snapshot_at, snapshot_date_key, published_at, testimonial_count)
        VALUES (${lease.tenantId}::uuid, ${lease.runId}::uuid, ${snapshot.at},
          (${snapshot.at} AT TIME ZONE 'UTC')::date, clock_timestamp(), ${counts.testimonials})`;
      const snapshotRows = await tx.$executeRaw`INSERT INTO dw.fact_testimonial_snapshot
        (tenant_id, run_id, testimonial_id, category_key, status_code, rating, score, created_at, published_at, has_image, has_video,
          snapshot_at, snapshot_date_key)
        SELECT t.tenant_id, t.run_id, t.testimonial_id, c.category_key, t.status_code, t.rating, t.score,
          t.created_at, t.published_at, t.has_image, t.has_video, ${snapshot.at}, (${snapshot.at} AT TIME ZONE 'UTC')::date
          FROM staging.testimonials t
        JOIN dw.dim_category c ON c.tenant_id = t.tenant_id AND c.source_category_id IS NOT DISTINCT FROM t.category_id
        WHERE t.tenant_id = ${lease.tenantId}::uuid AND t.run_id = ${lease.runId}::uuid`;
      await tx.$executeRaw`DELETE FROM dw.fact_engagement_daily WHERE tenant_id = ${lease.tenantId}::uuid`;
      const engagementRows = await tx.$executeRaw`INSERT INTO dw.fact_engagement_daily
        (tenant_id, testimonial_id, date_key, source_key, event_type_key, event_count, last_reconciled_run_id)
        SELECT e.tenant_id, e.testimonial_id, (e.created_at AT TIME ZONE 'UTC')::date, s.source_key, k.event_type_key,
          count(*)::bigint, ${lease.runId}::uuid FROM staging.analytics_events e
        JOIN dw.dim_source s ON s.tenant_id = e.tenant_id AND s.code = e.source_code
        JOIN dw.dim_event_type k ON k.code = e.event_type_code
        WHERE e.tenant_id = ${lease.tenantId}::uuid AND e.run_id = ${lease.runId}::uuid
        GROUP BY e.tenant_id, e.testimonial_id, (e.created_at AT TIME ZONE 'UTC')::date, s.source_key, k.event_type_key`;
      const [total] = await tx.$queryRaw<Array<{ count: Prisma.Decimal; header: bigint; details: bigint }>>`
        SELECT (SELECT coalesce(sum(event_count), 0) FROM dw.fact_engagement_daily WHERE tenant_id = ${lease.tenantId}::uuid) AS count,
          h.testimonial_count AS header, (SELECT count(*) FROM dw.fact_testimonial_snapshot f
            WHERE f.tenant_id = h.tenant_id AND f.run_id = h.run_id) AS details
        FROM dw.fact_tenant_snapshot h WHERE h.tenant_id = ${lease.tenantId}::uuid AND h.run_id = ${lease.runId}::uuid`;
      if (BigInt(snapshotRows) !== counts.testimonials || !total || total.count.toString() !== counts.events.toString()
        || total.header !== counts.testimonials || total.details !== counts.testimonials) {
        throw new EtlError('BI_SOURCE_INCONSISTENT');
      }
      await this.clearStaging(tx, lease.tenantId, lease.runId);
      // Record completion after staging cleanup so freshness and duration include that work.
      const completed = await tx.$queryRaw<Array<{ run_id: string }>>`
        WITH completed AS (UPDATE etl.runs SET status = 'succeeded', finished_at = clock_timestamp(),
          source_category_count = ${counts.categories}, source_testimonial_count = ${counts.testimonials},
          source_event_count = ${counts.events}, snapshot_row_count = ${BigInt(snapshotRows)}, engagement_row_count = ${BigInt(engagementRows)}
          WHERE tenant_id = ${lease.tenantId}::uuid AND id = ${lease.runId}::uuid AND status = 'running'
          RETURNING tenant_id, id, finished_at)
        UPDATE dw.fact_tenant_snapshot h SET published_at = r.finished_at FROM completed r
        WHERE h.tenant_id = ${lease.tenantId}::uuid AND h.run_id = ${lease.runId}::uuid
          AND r.tenant_id = h.tenant_id AND r.id = h.run_id RETURNING h.run_id`;
      if (completed.length !== 1) throw new EtlError('BI_SOURCE_INCONSISTENT');
      await this.publicationCompleted(tx, lease);
      // Recheck at the END: a publication that outlives its lease rolls back entirely.
      const changed = await tx.$executeRaw`UPDATE etl.tenant_load_state SET last_published_run_id = ${lease.runId}::uuid,
        lease_run_id = NULL, lease_token = NULL, lease_until = NULL
        WHERE tenant_id = ${lease.tenantId}::uuid AND lease_run_id = ${lease.runId}::uuid
          AND lease_token = ${lease.token}::uuid AND lease_until > clock_timestamp()`;
      if (changed !== 1) throw new EtlError('BI_LEASE_LOST');
      if (Date.now() >= lease.deadline) throw new EtlError('BI_DEADLINE_EXCEEDED');
    }, lease.deadline);
  }

  async status(lease: Lease): Promise<string | null> {
    return this.transaction(async tx => {
      const [run] = await tx.$queryRaw<Array<{ status: string }>>`
        SELECT status FROM etl.runs WHERE tenant_id = ${lease.tenantId}::uuid AND id = ${lease.runId}::uuid`;
      return run?.status ?? null;
    });
  }

  async fail(lease: Lease, code: string): Promise<void> {
    await this.transaction(async tx => {
      await this.lockTenant(tx, lease.tenantId);
      const [state] = await tx.$queryRaw<Array<{ token: string | null; runId: string | null }>>`
        SELECT lease_token AS token, lease_run_id AS "runId" FROM etl.tenant_load_state
        WHERE tenant_id = ${lease.tenantId}::uuid FOR UPDATE`;
      if (state?.token !== lease.token || state.runId !== lease.runId) return;
      const status = code === 'BI_SLOT_CHANGED' ? 'abandoned' : 'failed';
      await tx.$executeRaw`UPDATE etl.runs SET status = ${status}, finished_at = clock_timestamp(), error_code = ${code}
        WHERE tenant_id = ${lease.tenantId}::uuid AND id = ${lease.runId}::uuid AND status = 'running'`;
      await this.attemptFailed(tx, lease, code);
      await this.clearStaging(tx, lease.tenantId, lease.runId);
      await tx.$executeRaw`UPDATE etl.tenant_load_state SET lease_run_id = NULL, lease_token = NULL, lease_until = NULL
        WHERE tenant_id = ${lease.tenantId}::uuid AND lease_run_id = ${lease.runId}::uuid AND lease_token = ${lease.token}::uuid`;
    });
  }

  protected async clearStaging(tx: Prisma.TransactionClient, tenantId: string, runId: string): Promise<void> {
    await tx.$executeRaw`DELETE FROM staging.analytics_events WHERE tenant_id = ${tenantId}::uuid AND run_id = ${runId}::uuid`;
    await tx.$executeRaw`DELETE FROM staging.testimonials WHERE tenant_id = ${tenantId}::uuid AND run_id = ${runId}::uuid`;
    await tx.$executeRaw`DELETE FROM staging.categories WHERE tenant_id = ${tenantId}::uuid AND run_id = ${runId}::uuid`;
  }
}
