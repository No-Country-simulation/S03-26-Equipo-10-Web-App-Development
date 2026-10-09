import { Prisma, PrismaClient } from '@prisma/client';
import { EtlError } from '../etl.types';
import { requireQuiescentEtl, requireSnapshotTimeExpansion, snapshotTimeTenants,
  verifySnapshotTimeHistory, verifySnapshotTimeTenant, SnapshotTimeValidationError, type SnapshotTimeStats } from './snapshot-time-validation';

export interface BackfillBatch { kind: 'headers' | 'details'; changed: bigint }
export class SnapshotTimeBackfillRepository {
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
    // Write checks see claims committed before the table locks; the locks stabilize their input afterwards.
    }, { isolationLevel: readOnly ? Prisma.TransactionIsolationLevel.RepeatableRead : Prisma.TransactionIsolationLevel.ReadCommitted,
      timeout: 35000, maxWait: 5000 });
  }

  check(): Promise<SnapshotTimeStats> { return this.transaction(tx => verifySnapshotTimeHistory(tx), true); }

  private async guard(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(543001)`;
    // Prevent claims/publication and manual changes while each bounded batch is verified and written.
    await tx.$executeRaw`LOCK TABLE etl.runs, etl.tenant_load_state IN SHARE MODE`;
    await tx.$executeRaw`LOCK TABLE dw.fact_testimonial_snapshot, dw.fact_tenant_snapshot IN SHARE ROW EXCLUSIVE MODE`;
    await requireSnapshotTimeExpansion(tx);
    await requireQuiescentEtl(tx);
  }

  private headers(tenantId: string): Promise<bigint> {
    return this.transaction(async tx => {
      await this.guard(tx);
      await verifySnapshotTimeTenant(tx, tenantId);
      // No run payloads in Node memory. Calendar insertion and header insertion use the same candidates.
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
        WITH candidates AS MATERIALIZED (SELECT r.id, r.source_snapshot_at, r.finished_at, r.snapshot_row_count
          FROM etl.runs r WHERE r.tenant_id = ${tenantId}::uuid AND r.status = 'succeeded'
          AND NOT EXISTS(SELECT 1 FROM dw.fact_tenant_snapshot h WHERE h.tenant_id = ${tenantId}::uuid AND h.run_id = r.id)
          ORDER BY r.id LIMIT ${this.pageSize}),
        dates AS (INSERT INTO dw.dim_date (date_key)
          SELECT DISTINCT (source_snapshot_at AT TIME ZONE 'UTC')::date FROM candidates ON CONFLICT DO NOTHING RETURNING date_key),
        inserted AS (INSERT INTO dw.fact_tenant_snapshot
          (tenant_id, run_id, snapshot_at, snapshot_date_key, published_at, testimonial_count)
          SELECT ${tenantId}::uuid, id, source_snapshot_at, (source_snapshot_at AT TIME ZONE 'UTC')::date,
            finished_at, snapshot_row_count FROM candidates
          ON CONFLICT (tenant_id, run_id) DO NOTHING RETURNING run_id)
        SELECT count(*) AS count FROM inserted`;
      return rows[0]?.count ?? 0n;
    });
  }

  private details(tenantId: string): Promise<bigint> {
    return this.transaction(async tx => {
      await this.guard(tx);
      await verifySnapshotTimeTenant(tx, tenantId);
      const [result] = await tx.$queryRaw<Array<{ count: bigint; unchanged: boolean | null }>>`
        WITH batch AS MATERIALIZED (
          SELECT f.run_id, f.testimonial_id, r.source_snapshot_at,
            to_jsonb(f) - 'snapshot_at' - 'snapshot_date_key' AS original
          FROM dw.fact_testimonial_snapshot f JOIN etl.runs r ON r.tenant_id = f.tenant_id AND r.id = f.run_id
          WHERE f.tenant_id = ${tenantId}::uuid AND r.status = 'succeeded' AND f.snapshot_at IS NULL
          ORDER BY f.run_id, f.testimonial_id LIMIT ${this.pageSize}),
        updated AS (UPDATE dw.fact_testimonial_snapshot f SET snapshot_at = b.source_snapshot_at,
          snapshot_date_key = (b.source_snapshot_at AT TIME ZONE 'UTC')::date FROM batch b
          WHERE f.tenant_id = ${tenantId}::uuid AND f.run_id = b.run_id AND f.testimonial_id = b.testimonial_id
          RETURNING f.run_id, f.testimonial_id, to_jsonb(f) - 'snapshot_at' - 'snapshot_date_key' AS original)
        SELECT count(*) AS count, bool_and(u.original = b.original) AS unchanged FROM updated u JOIN batch b
          ON b.run_id = u.run_id AND b.testimonial_id = u.testimonial_id`;
      if (!result || result.count > 0n && result.unchanged !== true) throw new SnapshotTimeValidationError('BI_BACKFILL_INCONSISTENT', tenantId);
      return result.count;
    });
  }

  async apply(options: { signal?: AbortSignal; afterBatch?: (batch: BackfillBatch) => void | Promise<void> } = {}): Promise<SnapshotTimeStats> {
    const checkSignal = () => { if (options.signal?.aborted) throw new EtlError('BI_BACKFILL_INTERRUPTED'); };
    checkSignal();
    // Validate the entire history before the first write; do not silently repair corrupt input.
    await this.check();
    let cursor: string | null = null;
    while (true) {
      checkSignal();
      const tenants = await this.transaction(tx => snapshotTimeTenants(tx, cursor), true);
      if (!tenants.length) break;
      for (const tenantId of tenants) {
        for (const kind of ['headers', 'details'] as const) {
          while (true) {
            checkSignal();
            const changed = kind === 'headers' ? await this.headers(tenantId) : await this.details(tenantId);
            if (changed === 0n) break;
            await options.afterBatch?.({ kind, changed });
          }
        }
        await this.transaction(async tx => { await this.guard(tx); await verifySnapshotTimeTenant(tx, tenantId, true); });
      }
      cursor = tenants.at(-1)!;
    }
    checkSignal();
    return this.transaction(tx => verifySnapshotTimeHistory(tx, true), true);
  }
}
