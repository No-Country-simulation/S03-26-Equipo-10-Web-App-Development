import type { Prisma } from '@prisma/client';
import { EtlError } from '../etl.types';

export interface SnapshotTimeStats { pendingRuns: bigint; pendingRows: bigint; successfulRuns: bigint }
export class SnapshotTimeValidationError extends EtlError {
  constructor(code: 'BI_BACKFILL_INCONSISTENT' | 'BI_BACKFILL_REQUIRED', readonly tenantId: string) { super(code); }
}

export async function requireSnapshotTimeExpansion(tx: Prisma.TransactionClient): Promise<void> {
  const [state] = await tx.$queryRaw<Array<{ expanded: boolean }>>`
    SELECT EXISTS(SELECT 1 FROM etl.schema_migrations WHERE version = '0002_snapshot_time_expand.sql') AS expanded`;
  if (!state?.expanded) throw new EtlError('BI_MIGRATION_INVALID');
}

export async function requireQuiescentEtl(tx: Prisma.TransactionClient): Promise<void> {
  // Explicit maintenance inventory. Even expired leases/running attempts require recovery first.
  const [state] = await tx.$queryRaw<Array<{ active: boolean }>>`
    SELECT EXISTS(SELECT 1 FROM etl.runs WHERE status = 'running')
      OR EXISTS(SELECT 1 FROM etl.tenant_load_state
        WHERE lease_run_id IS NOT NULL OR lease_token IS NOT NULL OR lease_until IS NOT NULL) AS active`;
  if (!state || state.active) throw new EtlError('BI_MAINTENANCE_REQUIRED');
}

export async function snapshotTimeTenants(tx: Prisma.TransactionClient, after: string | null): Promise<string[]> {
  // Only maintenance identifiers are enumerated; private resources are checked per tenant below.
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT tenant_id AS id FROM (
      SELECT tenant_id FROM etl.runs UNION SELECT tenant_id FROM dw.fact_testimonial_snapshot
      UNION SELECT tenant_id FROM dw.fact_tenant_snapshot
    ) tenants WHERE (${after}::uuid IS NULL OR tenant_id > ${after}::uuid) ORDER BY tenant_id LIMIT 1000`;
  return rows.map(row => row.id);
}

export async function verifySnapshotTimeTenant(tx: Prisma.TransactionClient, tenantId: string, complete = false): Promise<SnapshotTimeStats> {
  const [state] = await tx.$queryRaw<Array<SnapshotTimeStats & { invalid: boolean }>>`
    WITH counts AS (SELECT run_id, count(*) AS amount FROM dw.fact_testimonial_snapshot
      WHERE tenant_id = ${tenantId}::uuid GROUP BY run_id),
    successful AS (SELECT r.*, coalesce(c.amount, 0) AS amount FROM etl.runs r
      LEFT JOIN counts c ON c.run_id = r.id WHERE r.tenant_id = ${tenantId}::uuid AND r.status = 'succeeded')
    SELECT
      (EXISTS(SELECT 1 FROM successful r WHERE r.source_snapshot_at IS NULL OR r.finished_at IS NULL
        OR r.snapshot_row_count <> r.amount OR r.source_testimonial_count <> r.amount
        OR NOT EXISTS(SELECT 1 FROM dw.dim_tenant d WHERE d.tenant_id = ${tenantId}::uuid))
      OR EXISTS(SELECT 1 FROM dw.fact_testimonial_snapshot f LEFT JOIN etl.runs r
        ON r.tenant_id = f.tenant_id AND r.id = f.run_id
        WHERE f.tenant_id = ${tenantId}::uuid AND (r.id IS NULL OR r.status <> 'succeeded'
          OR (f.snapshot_at IS NULL) <> (f.snapshot_date_key IS NULL)
          OR (f.snapshot_at IS NOT NULL AND (f.snapshot_at <> r.source_snapshot_at
            OR f.snapshot_date_key <> (r.source_snapshot_at AT TIME ZONE 'UTC')::date
            OR NOT EXISTS(SELECT 1 FROM dw.dim_date d WHERE d.date_key = f.snapshot_date_key)))))
      OR EXISTS(SELECT 1 FROM dw.fact_tenant_snapshot h LEFT JOIN etl.runs r
        ON r.tenant_id = h.tenant_id AND r.id = h.run_id
        WHERE h.tenant_id = ${tenantId}::uuid AND (r.id IS NULL OR r.status <> 'succeeded'
          OR h.snapshot_at <> r.source_snapshot_at OR h.snapshot_date_key <> (r.source_snapshot_at AT TIME ZONE 'UTC')::date
          OR h.published_at <> r.finished_at OR h.testimonial_count <> r.snapshot_row_count))) AS invalid,
      (SELECT count(*) FROM successful r WHERE NOT EXISTS(SELECT 1 FROM dw.fact_tenant_snapshot h
        WHERE h.tenant_id = ${tenantId}::uuid AND h.run_id = r.id)) AS "pendingRuns",
      (SELECT count(*) FROM dw.fact_testimonial_snapshot WHERE tenant_id = ${tenantId}::uuid AND snapshot_at IS NULL) AS "pendingRows",
      (SELECT count(*) FROM successful) AS "successfulRuns"`;
  if (!state || state.invalid) throw new SnapshotTimeValidationError('BI_BACKFILL_INCONSISTENT', tenantId);
  if (complete && (state.pendingRuns > 0n || state.pendingRows > 0n)) throw new SnapshotTimeValidationError('BI_BACKFILL_REQUIRED', tenantId);
  return { pendingRuns: state.pendingRuns, pendingRows: state.pendingRows, successfulRuns: state.successfulRuns };
}

export async function verifySnapshotTimeHistory(tx: Prisma.TransactionClient, complete = false): Promise<SnapshotTimeStats> {
  await requireSnapshotTimeExpansion(tx);
  await requireQuiescentEtl(tx);
  let cursor: string | null = null;
  const totals: SnapshotTimeStats = { pendingRuns: 0n, pendingRows: 0n, successfulRuns: 0n };
  while (true) {
    const tenants = await snapshotTimeTenants(tx, cursor);
    if (!tenants.length) return totals;
    for (const tenantId of tenants) {
      const state = await verifySnapshotTimeTenant(tx, tenantId, complete);
      totals.pendingRuns += state.pendingRuns; totals.pendingRows += state.pendingRows; totals.successfulRuns += state.successfulRuns;
    }
    cursor = tenants.at(-1)!;
  }
}
