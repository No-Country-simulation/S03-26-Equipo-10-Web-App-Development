import type { PrismaClient } from '@prisma/client';
import { STATISTICS_MIGRATION } from './statistics-data';

/** Opt-in only. A missing optional schema never prevents the legacy worker from running. */
export async function statisticsDataReady(source: PrismaClient, target: PrismaClient, requested: boolean): Promise<boolean> {
  if (!requested) return false;
  try {
    const [schema] = await target.$queryRaw<Array<{ ready: boolean }>>`SELECT EXISTS(
      SELECT 1 FROM etl.schema_migrations WHERE version = ${STATISTICS_MIGRATION}) AS ready`;
    if (!schema?.ready) return false;
    await source.$queryRaw`SELECT tenant_id, tag_id, name FROM bi_export.tags LIMIT 0`;
    await source.$queryRaw`SELECT tenant_id, testimonial_id, tag_id FROM bi_export.testimonial_tags LIMIT 0`;
    // LIMIT 0 checks object access without loading any tenant data into the process.
    await target.$queryRaw`SELECT 1 FROM staging.tags, staging.testimonial_tags, dw.dim_tag,
      dw.fact_tag_snapshot, dw.bridge_testimonial_tag_snapshot, dw.fact_testimonial_creation,
      dw.statistics_history_state LIMIT 0`;
    const [permissions] = await target.$queryRaw<Array<{ ready: boolean }>>`
      WITH required(relation, privilege) AS (VALUES
        ('staging.tags', 'INSERT'), ('staging.tags', 'DELETE'),
        ('staging.testimonial_tags', 'INSERT'), ('staging.testimonial_tags', 'DELETE'),
        ('dw.dim_tag', 'INSERT'), ('dw.dim_tag', 'UPDATE'), ('dw.fact_tag_snapshot', 'INSERT'),
        ('dw.bridge_testimonial_tag_snapshot', 'INSERT'), ('dw.fact_testimonial_creation', 'INSERT'),
        ('dw.statistics_history_state', 'INSERT'), ('dw.statistics_history_state', 'UPDATE'))
      SELECT bool_and(coalesce(has_table_privilege(current_user, to_regclass(relation), privilege), false)) AS ready
      FROM required`;
    if (!permissions?.ready) return false;
    const [history] = await target.$queryRaw<Array<{ pending: boolean }>>`
      WITH latest AS (SELECT DISTINCT ON (tenant_id) tenant_id, run_id FROM dw.fact_tenant_snapshot
        ORDER BY tenant_id, snapshot_at DESC, run_id)
      SELECT EXISTS(SELECT 1 FROM latest h LEFT JOIN dw.statistics_history_state s ON s.tenant_id = h.tenant_id
        WHERE s.creations_through_run_id IS DISTINCT FROM h.run_id) AS pending`;
    return history?.pending === false;
  } catch { return false; } // No driver details or credentials in optional feature diagnostics.
}
