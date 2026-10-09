import { PrismaClient } from '@prisma/client';
import { EtlError } from '../etl.types';

/** Technical inventory/queue discovery only; all resource work remains tenant scoped. */
export class WorkerControlRepository {
  constructor(private readonly client: PrismaClient) {}

  async ready(): Promise<void> {
    const rows = await this.client.$queryRaw<Array<{ version: string }>>`
      SELECT version FROM etl.schema_migrations WHERE version = '0004_bi_operations.sql'`;
    if (rows.length !== 1) throw new EtlError('BI_MIGRATION_REQUIRED');
  }

  async provision(tenantIds: string[]): Promise<void> {
    if (tenantIds.length > 1000) throw new EtlError('BI_CONFIGURATION_INVALID');
    if (!tenantIds.length) return;
    await this.client.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
      await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
      await tx.$executeRaw`INSERT INTO etl.tenant_settings (tenant_id)
        SELECT value::uuid FROM jsonb_array_elements_text(${JSON.stringify(tenantIds)}::jsonb)
        ON CONFLICT (tenant_id) DO NOTHING`;
    }, { timeout: 10000, maxWait: 1000 });
  }

  async candidates(after: string | null): Promise<string[]> {
    // Bounded discovery, including expired work and orphans, independently of the source inventory.
    return this.client.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
      const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT tenant_id AS id FROM (
        SELECT tenant_id FROM etl.tenant_settings WHERE schedule_enabled AND next_scheduled_at <= clock_timestamp()
        UNION SELECT tenant_id FROM etl.load_requests WHERE status IN ('pending', 'running')
        UNION SELECT tenant_id FROM etl.tenant_load_state WHERE lease_run_id IS NOT NULL
        UNION SELECT tenant_id FROM etl.runs WHERE status = 'running'
      ) candidates WHERE (${after}::uuid IS NULL OR tenant_id > ${after}::uuid) ORDER BY tenant_id LIMIT 100`;
      return rows.map(row => row.id);
    }, { timeout: 10000, maxWait: 1000 });
  }

  async heartbeat(workerId: string, stopping = false): Promise<void> {
    await this.client.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
      await tx.$executeRaw`INSERT INTO etl.worker_health (worker_id, protocol_version, stopping)
        VALUES (${workerId}::uuid, 1, ${stopping}) ON CONFLICT (worker_id) DO UPDATE
        SET last_seen_at = clock_timestamp(), stopping = excluded.stopping`;
    }, { timeout: 10000, maxWait: 1000 });
  }
}
