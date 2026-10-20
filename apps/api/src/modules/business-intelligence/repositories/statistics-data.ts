import type { Prisma } from '@prisma/client';
import { EtlError, type Counts, type Lease } from '../etl.types';

export const STATISTICS_MIGRATION = '0005_bi_statistics.sql';

/** Called inside the existing fenced publication, after header/detail insertion. */
export async function publishStatisticsData(tx: Prisma.TransactionClient, lease: Lease, counts: Counts): Promise<void> {
  if (!counts.taxonomy) throw new EtlError('BI_SOURCE_INCONSISTENT');
  const [state] = await tx.$queryRaw<Array<{ tags: bigint; relations: bigint; initialized: boolean; invalid: boolean }>>`
    SELECT (SELECT count(*) FROM staging.tags WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid) AS tags,
      (SELECT count(*) FROM staging.testimonial_tags WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid) AS relations,
      NOT EXISTS(SELECT 1 FROM dw.fact_tenant_snapshot h WHERE h.tenant_id = ${lease.tenantId}::uuid AND h.run_id <> ${lease.runId}::uuid)
      OR EXISTS(SELECT 1 FROM dw.statistics_history_state s WHERE s.tenant_id = ${lease.tenantId}::uuid
        AND s.creations_through_run_id = (SELECT h.run_id FROM dw.fact_tenant_snapshot h
          WHERE h.tenant_id = ${lease.tenantId}::uuid AND h.run_id <> ${lease.runId}::uuid
          ORDER BY h.snapshot_at DESC, h.run_id LIMIT 1)) AS initialized,
      EXISTS(SELECT 1 FROM staging.testimonials t JOIN dw.fact_testimonial_creation c
        ON c.tenant_id = t.tenant_id AND c.testimonial_id = t.testimonial_id
        WHERE t.tenant_id = ${lease.tenantId}::uuid AND t.run_id = ${lease.runId}::uuid AND c.created_at <> t.created_at) AS invalid`;
  if (!state || state.tags !== counts.taxonomy.tags || state.relations !== counts.taxonomy.relations || state.invalid) {
    throw new EtlError('BI_SOURCE_INCONSISTENT');
  }
  if (!state.initialized) throw new EtlError('BI_BACKFILL_REQUIRED');
  await tx.$executeRaw`UPDATE dw.dim_tag SET is_present = false WHERE tenant_id = ${lease.tenantId}::uuid`;
  await tx.$executeRaw`INSERT INTO dw.dim_tag (tenant_id, tag_id, name)
    SELECT tenant_id, tag_id, name FROM staging.tags WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid
    ON CONFLICT (tenant_id, tag_id) DO UPDATE SET name = excluded.name, is_present = true`;
  await tx.$executeRaw`INSERT INTO dw.fact_tag_snapshot (tenant_id, run_id, tag_count, relation_count)
    VALUES (${lease.tenantId}::uuid, ${lease.runId}::uuid, ${counts.taxonomy.tags}, ${counts.taxonomy.relations})`;
  const inserted = await tx.$executeRaw`INSERT INTO dw.bridge_testimonial_tag_snapshot (tenant_id, run_id, testimonial_id, tag_id)
    SELECT tenant_id, run_id, testimonial_id, tag_id FROM staging.testimonial_tags
    WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid`;
  if (BigInt(inserted) !== counts.taxonomy.relations) throw new EtlError('BI_SOURCE_INCONSISTENT');
  await tx.$executeRaw`INSERT INTO dw.fact_testimonial_creation
    (tenant_id, testimonial_id, created_at, first_observed_at, first_observed_date_key, first_observed_run_id)
    SELECT tenant_id, testimonial_id, created_at, snapshot_at, snapshot_date_key, run_id FROM dw.fact_testimonial_snapshot
    WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.runId}::uuid
    ON CONFLICT (tenant_id, testimonial_id) DO NOTHING`;
  await tx.$executeRaw`INSERT INTO dw.statistics_history_state (tenant_id, creations_through_run_id)
    VALUES (${lease.tenantId}::uuid, ${lease.runId}::uuid)
    ON CONFLICT (tenant_id) DO UPDATE SET creations_through_run_id = excluded.creations_through_run_id`;
}
