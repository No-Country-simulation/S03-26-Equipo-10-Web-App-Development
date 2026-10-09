import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ConsoleLogger } from '@nestjs/common';
import { applyWarehouseMigration } from '../src/modules/business-intelligence/repositories/warehouse-migrations';
import { SnapshotTimeBackfillRepository } from '../src/modules/business-intelligence/repositories/snapshot-time-backfill.repository';
import { main as migrate } from '../src/modules/business-intelligence/migration.cli';
import { main as backfill } from '../src/modules/business-intelligence/snapshot-time-backfill.cli';

const adminUrl = process.env.TEST_BI_WAREHOUSE_DATABASE_URL;
const databaseTests = adminUrl ? describe : describe.skip;
databaseTests('snapshot time evolution on disposable PostgreSQL 18', () => {
  jest.setTimeout(30000);
  const database = `bi_time_${randomUUID().replaceAll('-', '')}`;
  const tenantA = randomUUID(); const tenantB = randomUUID(); const tenantEmpty = randomUUID();
  let parent: PrismaClient; let client: PrismaClient; let url: string; let repository: SnapshotTimeBackfillRepository;
  const sql = new Map(['0001_initial.sql', '0002_snapshot_time_expand.sql', '0003_snapshot_time_constraints.sql'].map(name => {
    // Repository-owned migration names, never caller paths.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return [name, readFileSync(join(__dirname, '../warehouse/migrations', name), 'utf8')];
  }));
  const apply = (name: string) => applyWarehouseMigration(client, name, sql.get(name)!);
  beforeAll(async () => {
    parent = new PrismaClient({ datasources: { db: { url: adminUrl! } } });
    await parent.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
    const parsed = new URL(adminUrl!); parsed.pathname = `/${database}`; parsed.searchParams.set('connection_limit', '1'); url = parsed.toString();
    client = new PrismaClient({ datasources: { db: { url } } }); repository = new SnapshotTimeBackfillRepository(client);
  });
  beforeEach(async () => {
    await client.$executeRawUnsafe('DROP SCHEMA IF EXISTS staging, dw, etl CASCADE');
    await apply('0001_initial.sql');
  });
  afterAll(async () => {
    await client?.$disconnect();
    if (parent) { await parent.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`); await parent.$disconnect(); }
  });
  async function seedRun(tenantId: string, snapshot: string, count: number) {
    const runId = randomUUID();
    await client.$executeRaw`INSERT INTO etl.runs
      (id, tenant_id, slot_at, attempt_no, status, started_at, source_snapshot_at, finished_at, source_testimonial_count, snapshot_row_count)
      VALUES (${runId}::uuid, ${tenantId}::uuid, date_trunc('hour', ${snapshot}::timestamptz AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',
        1, 'succeeded', ${snapshot}::timestamptz - interval '10 seconds', ${snapshot}::timestamptz,
        ${snapshot}::timestamptz + interval '1 second', ${count}, ${count})`;
    await client.$executeRaw`INSERT INTO dw.dim_testimonial (tenant_id, testimonial_id)
      SELECT ${tenantId}::uuid, gen_random_uuid() FROM generate_series(1, ${count})`;
    await client.$executeRaw`INSERT INTO dw.fact_testimonial_snapshot
      (tenant_id, run_id, testimonial_id, category_key, status_code, rating, score, created_at, has_image, has_video)
      SELECT t.tenant_id, ${runId}::uuid, t.testimonial_id, c.category_key, 'published', 4, 42.1234, '2023-01-01Z', true, false
      FROM dw.dim_testimonial t JOIN dw.dim_category c ON c.tenant_id = t.tenant_id
      WHERE t.tenant_id = ${tenantId}::uuid AND NOT EXISTS(SELECT 1 FROM dw.fact_testimonial_snapshot f
        WHERE f.tenant_id = t.tenant_id AND f.testimonial_id = t.testimonial_id)`;
    return runId;
  }
  async function seed() {
    await client.$executeRaw`INSERT INTO dw.dim_tenant (tenant_id, name, is_active)
      VALUES (${tenantA}::uuid, 'Synthetic A', true), (${tenantB}::uuid, 'Synthetic B', true), (${tenantEmpty}::uuid, 'Synthetic empty', true)`;
    await client.$executeRaw`INSERT INTO dw.dim_category (tenant_id, name)
      VALUES (${tenantA}::uuid, 'Sin categoría'), (${tenantB}::uuid, 'Sin categoría')`;
    await client.$executeRaw`INSERT INTO dw.dim_status (status_code) VALUES ('published')`;
    const first = await seedRun(tenantA, '2024-02-29T23:59:59.999Z', 1001);
    const empty = await seedRun(tenantA, '2024-03-01T00:00:00.000Z', 0);
    const other = await seedRun(tenantB, '2025-01-01T00:00:00.000Z', 1);
    const alwaysEmpty = await seedRun(tenantEmpty, '2024-03-01T01:00:00.000Z', 0);
    return { first, empty, other, alwaysEmpty };
  }
  async function originalDigest() {
    return client.$transaction(async tx => {
      // JSON encodes timestamptz using the session zone. Compare originals in the same UTC representation.
      await tx.$executeRaw`SET LOCAL timezone = 'UTC'`;
      return tx.$queryRaw`SELECT md5(string_agg((to_jsonb(f) - 'snapshot_at' - 'snapshot_date_key')::text,
        ',' ORDER BY tenant_id, run_id, testimonial_id)) AS digest FROM dw.fact_testimonial_snapshot f`;
    });
  }
  async function expandedSeed() { const runs = await seed(); await apply('0002_snapshot_time_expand.sql'); return runs; }

  it('bounds maintenance lock waits and resumes after a conflicting transaction is released', async () => {
    await expandedSeed();
    const blocker = new PrismaClient({ datasources: { db: { url } } });
    let locked!: () => void; let release!: () => void;
    const started = new Promise<void>(resolve => { locked = resolve; });
    const resume = new Promise<void>(resolve => { release = resolve; });
    const pending = blocker.$transaction(async tx => {
      await tx.$executeRaw`LOCK TABLE etl.runs IN ROW EXCLUSIVE MODE`; locked(); await resume;
    }, { timeout: 15000 });
    const settled = pending.then(() => undefined, () => undefined);
    try {
      await Promise.race([started, pending.then(() => { throw new Error('Expected maintenance blocker'); })]);
      await expect(repository.apply()).rejects.toMatchObject({ code: 'P2010', meta: expect.objectContaining({ code: '55P03' }) });
      expect(await client.$queryRaw`SELECT count(*) AS count FROM dw.fact_tenant_snapshot`).toEqual([{ count: 0n }]);
      release(); await pending;
      expect(await repository.apply()).toMatchObject({ pendingRuns: 0n, pendingRows: 0n });
    } finally { release(); await settled; await blocker.$disconnect(); }
  });

  it('installs fresh, respects the CLI boundary and preserves the initial migration ledger', async () => {
    const previous = process.env.BI_MIGRATION_DATABASE_URL; const log = jest.spyOn(ConsoleLogger.prototype, 'log').mockImplementation(() => undefined);
    try {
      process.env.BI_MIGRATION_DATABASE_URL = url;
      await expect(apply('0003_snapshot_time_constraints.sql')).rejects.toMatchObject({ code: 'BI_MIGRATION_INVALID' });
      await migrate(['--apply', '--to', '0002_snapshot_time_expand.sql']);
      expect(await client.$queryRaw`SELECT version FROM etl.schema_migrations ORDER BY version`)
        .toEqual([{ version: '0001_initial.sql' }, { version: '0002_snapshot_time_expand.sql' }]);
      await expect(migrate(['--apply', '--to', '9999_missing.sql'])).rejects.toMatchObject({ code: 'BI_MIGRATION_INVALID' });
      await migrate(['--apply']);
      expect(await apply('0001_initial.sql')).toBe(false); expect(await apply('0003_snapshot_time_constraints.sql')).toBe(false);
      await expect(applyWarehouseMigration(client, '0001_initial.sql', sql.get('0001_initial.sql')! + '-- drift\n'))
        .rejects.toMatchObject({ code: 'BI_MIGRATION_DRIFT' });
    } finally { log.mockRestore(); if (previous === undefined) delete process.env.BI_MIGRATION_DATABASE_URL; else process.env.BI_MIGRATION_DATABASE_URL = previous; }
  });
  it('copies every successful cut including empty cuts, preserves values and uses UTC in another session zone', async () => {
    await apply('0002_snapshot_time_expand.sql'); // A legacy writer can still insert its original columns.
    const runs = await seed(); const digest = await originalDigest();
    await client.$executeRaw`SET timezone = 'America/Los_Angeles'`;
    expect(await repository.check()).toEqual({ pendingRuns: 4n, pendingRows: 1002n, successfulRuns: 4n });
    expect(await repository.apply()).toEqual({ pendingRuns: 0n, pendingRows: 0n, successfulRuns: 4n });
    expect(await originalDigest()).toEqual(digest);
    expect(await client.$queryRaw`SELECT snapshot_at, snapshot_date_key::text AS date, testimonial_count AS count
      FROM dw.fact_tenant_snapshot WHERE tenant_id = ${tenantA}::uuid ORDER BY snapshot_at`)
      .toEqual([{ snapshot_at: new Date('2024-02-29T23:59:59.999Z'), date: '2024-02-29', count: 1001n },
        { snapshot_at: new Date('2024-03-01T00:00:00Z'), date: '2024-03-01', count: 0n }]);
    expect(await client.$queryRaw`SELECT snapshot_date_key::text AS date FROM dw.fact_tenant_snapshot
      WHERE tenant_id = ${tenantB}::uuid AND run_id = ${runs.other}::uuid`).toEqual([{ date: '2025-01-01' }]);
    expect(await repository.apply()).toEqual({ pendingRuns: 0n, pendingRows: 0n, successfulRuns: 4n });
    await apply('0003_snapshot_time_constraints.sql');
  });
  it('resumes an interrupted bounded batch without duplicating headers or altering original fields', async () => {
    await expandedSeed(); const digest = await originalDigest(); const controller = new AbortController();
    const small = new SnapshotTimeBackfillRepository(client, 2);
    await expect(small.apply({ signal: controller.signal, afterBatch: batch => { if (batch.kind === 'details') controller.abort(); } }))
      .rejects.toMatchObject({ code: 'BI_BACKFILL_INTERRUPTED' });
    const pending = await repository.check(); expect(pending.pendingRows).toBeGreaterThan(0n); expect(pending.pendingRows).toBeLessThan(1002n);
    await repository.apply(); expect(await originalDigest()).toEqual(digest);
    expect(await client.$queryRaw`SELECT count(*) AS count FROM dw.fact_tenant_snapshot`).toEqual([{ count: 4n }]);
  });
  it('rejects closure before backfill, including an omitted empty cut after detail conversion', async () => {
    const runs = await expandedSeed();
    await expect(apply('0003_snapshot_time_constraints.sql')).rejects.toMatchObject({ code: 'BI_BACKFILL_REQUIRED' });
    await repository.apply();
    await client.$executeRaw`DELETE FROM dw.fact_tenant_snapshot WHERE tenant_id = ${tenantEmpty}::uuid AND run_id = ${runs.alwaysEmpty}::uuid`;
    await expect(apply('0003_snapshot_time_constraints.sql')).rejects.toMatchObject({ code: 'BI_BACKFILL_REQUIRED' });
    await repository.apply(); await apply('0003_snapshot_time_constraints.sql');
  });
  it.each(['partial', 'instant', 'date'])('rejects a %s timestamp conflict rather than silently overwriting it', async mode => {
    const runs = await expandedSeed();
    const at = mode === 'instant' ? '2024-02-29T23:59:59.998Z' : '2024-02-29T23:59:59.999Z';
    const date = mode === 'partial' ? null : mode === 'date' ? '2024-03-01' : '2024-02-29';
    await client.$executeRaw`INSERT INTO dw.dim_date (date_key) VALUES ('2024-02-29'), ('2024-03-01')`;
    await client.$executeRaw`UPDATE dw.fact_testimonial_snapshot SET snapshot_at = ${at}::timestamptz, snapshot_date_key = ${date}::date
      WHERE tenant_id = ${tenantA}::uuid AND run_id = ${runs.first}::uuid`;
    await expect(repository.apply()).rejects.toMatchObject({ code: 'BI_BACKFILL_INCONSISTENT' });
    expect(await client.$queryRaw`SELECT count(*) AS count FROM dw.fact_tenant_snapshot`).toEqual([{ count: 0n }]);
  });
  it('rejects facts attached to a failed run rather than importing them as successful history', async () => {
    const runs = await expandedSeed();
    await client.$executeRaw`UPDATE etl.runs SET status = 'failed', error_code = 'BI_ETL_FAILED'
      WHERE tenant_id = ${tenantB}::uuid AND id = ${runs.other}::uuid`;
    await expect(repository.apply()).rejects.toMatchObject({ code: 'BI_BACKFILL_INCONSISTENT' });
    expect(await client.$queryRaw`SELECT count(*) AS count FROM dw.fact_tenant_snapshot`).toEqual([{ count: 0n }]);
  });
  it('detects lost original rows before writing any company', async () => {
    const runs = await expandedSeed();
    await client.$executeRaw`DELETE FROM dw.fact_testimonial_snapshot WHERE tenant_id = ${tenantB}::uuid AND run_id = ${runs.other}::uuid`;
    await expect(repository.apply()).rejects.toMatchObject({ code: 'BI_BACKFILL_INCONSISTENT' });
    expect(await client.$queryRaw`SELECT count(*) AS count FROM dw.fact_tenant_snapshot`).toEqual([{ count: 0n }]);
  });
  it('rejects a header with altered publication metadata and blocks closure', async () => {
    await expandedSeed(); await repository.apply();
    await client.$executeRaw`UPDATE dw.fact_tenant_snapshot SET published_at = published_at + interval '1 second' WHERE tenant_id = ${tenantA}::uuid`;
    await expect(repository.check()).rejects.toMatchObject({ code: 'BI_BACKFILL_INCONSISTENT' });
    await expect(apply('0003_snapshot_time_constraints.sql')).rejects.toMatchObject({ code: 'BI_BACKFILL_INCONSISTENT' });
  });
  it('requires maintenance even for an expired lease and never clears it automatically', async () => {
    const runs = await expandedSeed();
    await client.$executeRaw`INSERT INTO etl.tenant_load_state (tenant_id, lease_run_id, lease_token, lease_until)
      VALUES (${tenantA}::uuid, ${runs.first}::uuid, gen_random_uuid(), '2020-01-01Z')`;
    await expect(repository.apply()).rejects.toMatchObject({ code: 'BI_MAINTENANCE_REQUIRED' });
    await expect(apply('0003_snapshot_time_constraints.sql')).rejects.toMatchObject({ code: 'BI_MAINTENANCE_REQUIRED' });
    expect(await client.$queryRaw`SELECT count(*) AS count FROM etl.tenant_load_state WHERE lease_token IS NOT NULL`).toEqual([{ count: 1n }]);
  });
  it('stops before another batch if a worker starts between committed batches', async () => {
    await expandedSeed(); let resumed = false;
    await expect(repository.apply({ afterBatch: async batch => {
      if (!resumed && batch.kind === 'headers') {
        resumed = true;
        await client.$executeRaw`INSERT INTO etl.runs (tenant_id, slot_at, attempt_no)
          VALUES (${tenantA}::uuid, date_trunc('hour', current_timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'UTC', 1)`;
      }
    } })).rejects.toMatchObject({ code: 'BI_MAINTENANCE_REQUIRED' });
    expect(await client.$queryRaw`SELECT count(*) AS count FROM dw.fact_testimonial_snapshot WHERE snapshot_at IS NOT NULL`).toEqual([{ count: 0n }]);
    expect(await client.$queryRaw`SELECT count(*) AS count FROM etl.runs WHERE status = 'running'`).toEqual([{ count: 1n }]);
  });
  it('rolls back a batch when a trigger changes an original field', async () => {
    await expandedSeed(); const digest = await originalDigest();
    await client.$executeRawUnsafe(`CREATE FUNCTION dw.synthetic_change() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN NEW.rating = 1; RETURN NEW; END; $$`);
    await client.$executeRawUnsafe('CREATE TRIGGER synthetic_change BEFORE UPDATE ON dw.fact_testimonial_snapshot FOR EACH ROW EXECUTE FUNCTION dw.synthetic_change()');
    await expect(repository.apply()).rejects.toMatchObject({ code: 'BI_BACKFILL_INCONSISTENT' });
    expect(await originalDigest()).toEqual(digest);
    expect((await repository.check()).pendingRows).toBe(1002n);
  });
  it('enforces nonnull time, UTC calendar and the header time after closure', async () => {
    const runs = await expandedSeed(); await repository.apply(); await apply('0003_snapshot_time_constraints.sql');
    await expect(client.$executeRaw`UPDATE dw.fact_testimonial_snapshot SET snapshot_at = NULL WHERE tenant_id = ${tenantA}::uuid`).rejects.toThrow();
    await expect(client.$executeRaw`UPDATE dw.fact_testimonial_snapshot SET snapshot_date_key = '2024-03-01' WHERE tenant_id = ${tenantA}::uuid`).rejects.toThrow();
    await expect(client.$executeRaw`UPDATE dw.fact_testimonial_snapshot SET snapshot_at = snapshot_at - interval '1 millisecond' WHERE tenant_id = ${tenantA}::uuid`).rejects.toThrow();
    await expect(client.$executeRaw`UPDATE dw.fact_testimonial_snapshot SET run_id = ${runs.other}::uuid WHERE tenant_id = ${tenantA}::uuid`).rejects.toThrow();
    await expect(client.$executeRaw`DELETE FROM dw.dim_date WHERE date_key = '2024-02-29'`).rejects.toThrow();
    expect((await repository.check()).pendingRows).toBe(0n);
  });
  it('reports pending work through the check CLI without writing and completes only with maintenance acknowledgement', async () => {
    await expandedSeed(); const previous = process.env.BI_MIGRATION_DATABASE_URL;
    const log = jest.spyOn(ConsoleLogger.prototype, 'log').mockImplementation(() => undefined);
    try {
      process.env.BI_MIGRATION_DATABASE_URL = url;
      await expect(backfill(['--check'])).rejects.toMatchObject({ code: 'BI_BACKFILL_REQUIRED' });
      expect(await client.$queryRaw`SELECT count(*) AS count FROM dw.fact_tenant_snapshot`).toEqual([{ count: 0n }]);
      await backfill(['--apply', '--maintenance']); await backfill(['--check']);
    } finally { log.mockRestore(); if (previous === undefined) delete process.env.BI_MIGRATION_DATABASE_URL; else process.env.BI_MIGRATION_DATABASE_URL = previous; }
  });
});
