import { Prisma, PrismaClient } from '@prisma/client';
import { EtlError } from '../etl.types';
import { requireQuiescentEtl, verifySnapshotTimeTenant } from './snapshot-time-validation';
import { STATISTICS_MIGRATION } from './statistics-data';

export interface StatisticsHistoryState { tenants: bigint; pendingTenants: bigint; missingCreations: bigint }

/** Maintenance identity only. Never instantiated by HTTP or the worker. */
export class StatisticsHistoryRepository {
  constructor(private readonly client: PrismaClient, private readonly pageSize = 1000) {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new EtlError('BI_CONFIGURATION_INVALID');
  }

  private transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>, readOnly = false): Promise<T> {
    return this.client.$transaction(async tx => {
      if (readOnly) await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL timezone = 'UTC'`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '30s'`;
      await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
      await tx.$executeRaw`SET LOCAL transaction_timeout = '35s'`;
      return work(tx);
    }, { isolationLevel: readOnly ? Prisma.TransactionIsolationLevel.RepeatableRead : Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 35000, maxWait: 5000 });
  }

  private async requireSchema(tx: Prisma.TransactionClient): Promise<void> {
    const [schema] = await tx.$queryRaw<Array<{ ready: boolean }>>`SELECT EXISTS(
      SELECT 1 FROM etl.schema_migrations WHERE version = ${STATISTICS_MIGRATION}) AS ready`;
    if (!schema?.ready) throw new EtlError('BI_MIGRATION_REQUIRED');
    await requireQuiescentEtl(tx);
    const [jobs] = await tx.$queryRaw<Array<{ active: boolean }>>`SELECT EXISTS(
      SELECT 1 FROM etl.statistics_jobs WHERE status = 'running') AS active`;
    if (jobs?.active) throw new EtlError('BI_MAINTENANCE_REQUIRED');
  }

  private async guard(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(543001)`;
    await tx.$executeRaw`LOCK TABLE etl.runs, etl.tenant_load_state, etl.statistics_jobs IN SHARE MODE`;
    await tx.$executeRaw`LOCK TABLE dw.fact_tenant_snapshot, dw.fact_testimonial_snapshot,
      dw.fact_testimonial_creation, dw.statistics_history_state IN SHARE ROW EXCLUSIVE MODE`;
    await this.requireSchema(tx);
  }

  private async tenants(tx: Prisma.TransactionClient, after: string | null): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT DISTINCT tenant_id AS id FROM dw.fact_tenant_snapshot
      WHERE (${after}::uuid IS NULL OR tenant_id > ${after}::uuid) ORDER BY tenant_id LIMIT ${this.pageSize}`;
    return rows.map(row => row.id);
  }

  private async verify(tx: Prisma.TransactionClient, tenantId: string): Promise<{ missing: bigint; pending: boolean }> {
    await verifySnapshotTimeTenant(tx, tenantId, true);
    const [state] = await tx.$queryRaw<Array<{ missing: bigint; pending: boolean; invalid: boolean }>>`
      WITH observed AS MATERIALIZED (
        SELECT DISTINCT ON (testimonial_id) testimonial_id, created_at, snapshot_at, snapshot_date_key, run_id
        FROM dw.fact_testimonial_snapshot WHERE tenant_id = ${tenantId}::uuid
        ORDER BY testimonial_id, snapshot_at, run_id)
      SELECT (SELECT count(*) FROM observed o WHERE NOT EXISTS(SELECT 1 FROM dw.fact_testimonial_creation c
        WHERE c.tenant_id = ${tenantId}::uuid AND c.testimonial_id = o.testimonial_id)) AS missing,
      NOT EXISTS(SELECT 1 FROM dw.statistics_history_state s WHERE s.tenant_id = ${tenantId}::uuid
        AND s.creations_through_run_id = (SELECT run_id FROM dw.fact_tenant_snapshot WHERE tenant_id = ${tenantId}::uuid
          ORDER BY snapshot_at DESC, run_id LIMIT 1)) AS pending,
      (EXISTS(SELECT 1 FROM dw.fact_testimonial_snapshot f JOIN observed o ON o.testimonial_id = f.testimonial_id
        WHERE f.tenant_id = ${tenantId}::uuid AND (f.created_at <> o.created_at OR f.created_at > f.snapshot_at))
      OR EXISTS(SELECT 1 FROM dw.fact_testimonial_creation c LEFT JOIN observed o ON o.testimonial_id = c.testimonial_id
        WHERE c.tenant_id = ${tenantId}::uuid AND (o.testimonial_id IS NULL OR c.created_at <> o.created_at
          OR c.first_observed_at <> o.snapshot_at OR c.first_observed_date_key <> o.snapshot_date_key
          OR c.first_observed_run_id <> o.run_id))
      OR EXISTS(SELECT 1 FROM dw.fact_tenant_snapshot h WHERE h.tenant_id = ${tenantId}::uuid
        AND h.testimonial_count <> (SELECT count(*) FROM dw.fact_testimonial_snapshot f
          WHERE f.tenant_id = h.tenant_id AND f.run_id = h.run_id))) AS invalid`;
    if (!state || state.invalid) throw new EtlError('BI_BACKFILL_INCONSISTENT');
    return { missing: state.missing, pending: state.pending || state.missing > 0n };
  }

  async check(): Promise<StatisticsHistoryState> {
    return this.transaction(async tx => {
      await this.requireSchema(tx);
      const result: StatisticsHistoryState = { tenants: 0n, pendingTenants: 0n, missingCreations: 0n };
      let cursor: string | null = null;
      while (true) {
        const tenants = await this.tenants(tx, cursor);
        if (!tenants.length) return result;
        for (const tenantId of tenants) {
          const state = await this.verify(tx, tenantId);
          result.tenants += 1n; result.pendingTenants += state.pending ? 1n : 0n; result.missingCreations += state.missing;
        }
        cursor = tenants.at(-1)!;
      }
    }, true);
  }

  private batch(tenantId: string, after: string | null): Promise<{ last: string | null; changed: bigint }> {
    return this.transaction(async tx => {
      await this.guard(tx);
      // The complete input is validated before writes and again before advancing the marker.
      // Each batch holds maintenance locks without rescanning the entire tenant history.
      const [result] = await tx.$queryRaw<Array<{ last: string | null; changed: bigint }>>`
        WITH candidates AS MATERIALIZED (SELECT DISTINCT testimonial_id FROM dw.fact_testimonial_snapshot
          WHERE tenant_id = ${tenantId}::uuid AND (${after}::uuid IS NULL OR testimonial_id > ${after}::uuid)
          ORDER BY testimonial_id LIMIT ${this.pageSize}),
        earliest AS (SELECT DISTINCT ON (f.testimonial_id) f.testimonial_id, f.created_at, f.snapshot_at, f.snapshot_date_key, f.run_id
          FROM dw.fact_testimonial_snapshot f JOIN candidates c ON c.testimonial_id = f.testimonial_id
          WHERE f.tenant_id = ${tenantId}::uuid ORDER BY f.testimonial_id, f.snapshot_at, f.run_id),
        inserted AS (INSERT INTO dw.fact_testimonial_creation
          (tenant_id, testimonial_id, created_at, first_observed_at, first_observed_date_key, first_observed_run_id)
          SELECT ${tenantId}::uuid, testimonial_id, created_at, snapshot_at, snapshot_date_key, run_id FROM earliest
          ON CONFLICT (tenant_id, testimonial_id) DO NOTHING RETURNING testimonial_id)
        SELECT (SELECT testimonial_id FROM candidates ORDER BY testimonial_id DESC LIMIT 1) AS last,
          (SELECT count(*) FROM inserted) AS changed`;
      if (!result) throw new EtlError('BI_BACKFILL_INCONSISTENT');
      return result;
    });
  }

  async apply(options: { signal?: AbortSignal; afterBatch?: (changed: bigint) => void | Promise<void> } = {}): Promise<StatisticsHistoryState> {
    const checkSignal = () => { if (options.signal?.aborted) throw new EtlError('BI_BACKFILL_INTERRUPTED'); };
    checkSignal();
    await this.check();
    let cursor: string | null = null;
    while (true) {
      checkSignal();
      const tenants = await this.transaction(tx => this.tenants(tx, cursor), true);
      if (!tenants.length) break;
      for (const tenantId of tenants) {
        let after: string | null = null;
        while (true) {
          checkSignal();
          const batch = await this.batch(tenantId, after);
          if (!batch.last) break;
          after = batch.last;
          await options.afterBatch?.(batch.changed);
        }
        checkSignal();
        await this.transaction(async tx => {
          await this.guard(tx);
          const state = await this.verify(tx, tenantId);
          if (state.missing > 0n) throw new EtlError('BI_BACKFILL_INCONSISTENT');
          await tx.$executeRaw`INSERT INTO dw.statistics_history_state (tenant_id, creations_through_run_id)
            SELECT tenant_id, run_id FROM dw.fact_tenant_snapshot WHERE tenant_id = ${tenantId}::uuid
            ORDER BY snapshot_at DESC, run_id LIMIT 1
            ON CONFLICT (tenant_id) DO UPDATE SET creations_through_run_id = excluded.creations_through_run_id`;
        });
      }
      cursor = tenants.at(-1)!;
    }
    checkSignal();
    return this.check();
  }
}
