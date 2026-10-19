import { StatisticsReadRepository } from '../src/modules/business-intelligence/repositories/statistics-read.repository';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { installBiWarehouse } from './fixtures/bi-warehouse';
import { applyWarehouseMigration } from '../src/modules/business-intelligence/repositories/warehouse-migrations';
import { StatisticsJobRepository } from '../src/modules/business-intelligence/repositories/statistics-job.repository';
import { StatisticsInputRepository } from '../src/modules/business-intelligence/repositories/statistics-input.repository';
import { statisticsEngineReady } from '../src/modules/business-intelligence/repositories/statistics-engine-preflight';
import { StatisticsService } from '../src/modules/business-intelligence/services/statistics.service';
import { calculateStatistics } from '../src/modules/business-intelligence/utils/statistics-engine';
import { statisticsPayloadSchema, type StatisticsLease } from '../src/modules/business-intelligence/statistics.types';

const adminUrl = process.env.TEST_BI_WAREHOUSE_DATABASE_URL;
const databaseTests = adminUrl ? describe : describe.skip;
databaseTests('statistical worker on disposable PostgreSQL 18 with restricted identities', () => {
  jest.setTimeout(30000);
  const suffix = randomUUID().replaceAll('-', ''); const database = `stats_worker_${suffix}`;
  const writer = `stats_job_${suffix}`; const reader = `stats_input_${suffix}`;
  const tenant = randomUUID(); const other = randomUUID();
  const tagA = '11111111-1111-4111-8111-111111111111'; const tagB = '22222222-2222-4222-8222-222222222222';
  let parent: PrismaClient; let admin: PrismaClient; let write: PrismaClient; let read: PrismaClient;
  let jobs: StatisticsJobRepository; let inputs: StatisticsInputRepository; let service: StatisticsService;
  function client(role?: string) {
    const url = new URL(adminUrl!); url.pathname = `/${database}`; url.searchParams.set('connection_limit', '2');
    if (role) { url.username = role; url.password = ''; }
    return new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] });
  }
  beforeAll(async () => {
    parent = new PrismaClient({ datasources: { db: { url: adminUrl! } } });
    await parent.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
    await parent.$executeRawUnsafe(`CREATE ROLE "${writer}" LOGIN`); await parent.$executeRawUnsafe(`CREATE ROLE "${reader}" LOGIN`);
    admin = client(); write = client(writer); read = client(reader);
    await installBiWarehouse(admin);
    for (const name of ['0004_bi_operations.sql', '0005_bi_statistics.sql']) {
      // Fixed repository migration basenames; no request-controlled files.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await applyWarehouseMigration(admin, name, readFileSync(join(__dirname, '../warehouse/migrations', name), 'utf8'));
    }
    await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA dw, etl TO "${writer}"`);
    await admin.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA dw TO "${writer}"`);
    await admin.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE ON etl.statistics_jobs, dw.statistics_current TO "${writer}"`);
    await admin.$executeRawUnsafe(`GRANT INSERT ON dw.statistics_publication TO "${writer}"`);
    await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA dw TO "${reader}"`);
    await admin.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA dw TO "${reader}"`);
    jobs = new StatisticsJobRepository(write); inputs = new StatisticsInputRepository(read); service = new StatisticsService(jobs, inputs);
  });
  beforeEach(async () => {
    await admin.$executeRawUnsafe('TRUNCATE dw.dim_tenant, dw.dim_date, dw.dim_status, etl.runs, etl.tenant_load_state RESTART IDENTITY CASCADE');
    await admin.$executeRaw`INSERT INTO dw.dim_status (status_code) VALUES ('published'), ('rejected')`;
  });
  afterAll(async () => {
    await Promise.all([admin?.$disconnect(), write?.$disconnect(), read?.$disconnect()]);
    if (parent) {
      await parent.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
      await parent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${writer}", "${reader}"`); await parent.$disconnect();
    }
  });

  async function cut(at: string, tenantId = tenant, total = 100, rejected = 0, low = 0, tagged = true) {
    const runId = randomUUID(); const date = new Date(at);
    await admin.$executeRaw`INSERT INTO dw.dim_tenant (tenant_id, name, is_active) VALUES (${tenantId}::uuid, 'Synthetic', true) ON CONFLICT DO NOTHING`;
    await admin.$executeRaw`INSERT INTO dw.dim_date (date_key) VALUES ((${date} AT TIME ZONE 'UTC')::date) ON CONFLICT DO NOTHING`;
    await admin.$executeRaw`INSERT INTO dw.dim_category (tenant_id, name) VALUES (${tenantId}::uuid, 'Sin categoría') ON CONFLICT DO NOTHING`;
    await admin.$executeRaw`INSERT INTO dw.dim_testimonial (tenant_id, testimonial_id)
      SELECT ${tenantId}::uuid, gen_random_uuid() FROM generate_series(1, ${total})
      WHERE NOT EXISTS(SELECT 1 FROM dw.dim_testimonial WHERE tenant_id = ${tenantId}::uuid)`;
    await admin.$executeRaw`INSERT INTO etl.runs
      (id, tenant_id, slot_at, attempt_no, status, started_at, source_snapshot_at, finished_at, source_testimonial_count, snapshot_row_count)
      VALUES (${runId}::uuid, ${tenantId}::uuid, date_trunc('hour', ${date} AT TIME ZONE 'UTC') AT TIME ZONE 'UTC',
        1, 'succeeded', ${date} - interval '1 second', ${date}, ${date} + interval '1 second', ${total}, ${total})`;
    await admin.$executeRaw`INSERT INTO dw.fact_tenant_snapshot (tenant_id, run_id, snapshot_at, snapshot_date_key, published_at, testimonial_count)
      VALUES (${tenantId}::uuid, ${runId}::uuid, ${date}, (${date} AT TIME ZONE 'UTC')::date, ${date} + interval '1 second', ${total})`;
    await admin.$executeRaw`INSERT INTO dw.fact_testimonial_snapshot
      (tenant_id, run_id, testimonial_id, category_key, status_code, rating, score, created_at, has_image, has_video, snapshot_at, snapshot_date_key)
      SELECT t.tenant_id, ${runId}::uuid, t.testimonial_id, c.category_key,
        CASE WHEN t.ordinal <= ${rejected} THEN 'rejected' ELSE 'published' END,
        CASE WHEN t.ordinal <= ${low} THEN 1 ELSE 5 END, 0, coalesce(f.created_at, '2024-01-01Z'::timestamptz), false, false,
        ${date}, (${date} AT TIME ZONE 'UTC')::date FROM (
          SELECT tenant_id, testimonial_id, row_number() OVER (ORDER BY testimonial_id) AS ordinal
          FROM dw.dim_testimonial WHERE tenant_id = ${tenantId}::uuid ORDER BY testimonial_id LIMIT ${total}) t
      JOIN dw.dim_category c ON c.tenant_id = t.tenant_id AND c.source_category_id IS NULL
      LEFT JOIN dw.fact_testimonial_creation f ON f.tenant_id = t.tenant_id AND f.testimonial_id = t.testimonial_id`;
    await admin.$executeRaw`INSERT INTO dw.fact_testimonial_creation
      (tenant_id, testimonial_id, created_at, first_observed_at, first_observed_date_key, first_observed_run_id)
      SELECT tenant_id, testimonial_id, created_at, snapshot_at, snapshot_date_key, run_id FROM dw.fact_testimonial_snapshot
      WHERE tenant_id = ${tenantId}::uuid AND run_id = ${runId}::uuid ON CONFLICT DO NOTHING`;
    await admin.$executeRaw`INSERT INTO dw.statistics_history_state VALUES (${tenantId}::uuid, ${runId}::uuid)
      ON CONFLICT (tenant_id) DO UPDATE SET creations_through_run_id = excluded.creations_through_run_id`;
    if (tagged) {
      await admin.$executeRaw`INSERT INTO dw.dim_tag (tenant_id, tag_id, name) VALUES
        (${tenantId}::uuid, ${tagA}::uuid, 'Synthetic A'), (${tenantId}::uuid, ${tagB}::uuid, 'Synthetic B') ON CONFLICT DO NOTHING`;
      await admin.$executeRaw`INSERT INTO dw.fact_tag_snapshot VALUES (${tenantId}::uuid, ${runId}::uuid, 2, ${Math.min(total, 40) + Math.max(0, Math.min(total, 50) - 30)})`;
      await admin.$executeRaw`INSERT INTO dw.bridge_testimonial_tag_snapshot
        SELECT ${tenantId}::uuid, ${runId}::uuid, f.testimonial_id, tags.tag_id FROM (
          SELECT testimonial_id, row_number() OVER (ORDER BY testimonial_id) AS ordinal FROM dw.fact_testimonial_snapshot
          WHERE tenant_id = ${tenantId}::uuid AND run_id = ${runId}::uuid) f
        CROSS JOIN (VALUES (${tagA}::uuid), (${tagB}::uuid)) tags(tag_id)
        WHERE (tags.tag_id = ${tagA}::uuid AND f.ordinal <= 40) OR (tags.tag_id = ${tagB}::uuid AND f.ordinal BETWEEN 31 AND 50)`;
    }
    return runId;
  }
  async function expire(lease: StatisticsLease) {
    await admin.$executeRaw`WITH instant AS (SELECT date_trunc('milliseconds', clock_timestamp()) - interval '2 minutes' AS at)
      UPDATE etl.statistics_jobs j SET created_at = t.at, claimed_at = t.at,
        lease_until = t.at + interval '90 seconds', deadline_at = t.at + interval '60 seconds'
      FROM instant t WHERE tenant_id = ${lease.tenantId}::uuid AND source_run_id = ${lease.sourceRunId}::uuid`;
  }
  const payload = async (lease: StatisticsLease) => calculateStatistics(await inputs.read(lease));

  it('discovers post-commit work idempotently and serializes two workers claiming the same tenant', async () => {
    await cut('2025-01-01Z'); expect(await jobs.discover()).toBe(1); expect(await jobs.discover()).toBe(0);
    const claims = await Promise.all([jobs.claim(), new StatisticsJobRepository(write).claim()]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await read.$queryRaw`SELECT count(*) AS n FROM dw.statistics_publication`).toEqual([{ n: 0n }]);
  });
  it('reads only its tenant, preserves original denominators and publishes three sections atomically', async () => {
    const runId = await cut('2025-01-01Z'); await cut('2025-01-01Z', other, 2);
    await jobs.discover(); const leases = [(await jobs.claim())!, (await jobs.claim())!];
    const lease = leases.find(value => value.tenantId === tenant)!;
    const foreignLease = leases.find(value => value.tenantId === other)!;
    const data = await inputs.read(lease); const result = calculateStatistics(data);
    expect(result.patterns.totalTestimonials).toBe('100');
    expect((await inputs.read(foreignLease)).patterns.total).toBe(2n);
    expect(result.patterns.associations).toEqual([{ tagA, tagB, count: '10', support: 0.1,
      confidenceAB: 0.25, confidenceBA: 0.5, lift: 1.25 }]);
    expect(await jobs.publish(lease, result)).toBe('succeeded'); expect(await jobs.succeeded(lease)).toBe(true);
    expect(await jobs.publish(lease, result)).toBe('succeeded');
    expect(await read.$queryRaw`SELECT count(*) AS n FROM dw.statistics_publication WHERE tenant_id = ${lease.tenantId}::uuid`).toEqual([{ n: 1n }]);
    await expect(read.$queryRaw`SELECT * FROM etl.statistics_jobs`).rejects.toThrow();
    await expect(write.$executeRaw`UPDATE dw.statistics_publication SET generated_at = clock_timestamp()`).rejects.toThrow();
    expect(await admin.$queryRaw`SELECT testimonial_count FROM dw.fact_tenant_snapshot WHERE tenant_id = ${tenant}::uuid AND run_id = ${runId}::uuid`)
      .toEqual([{ testimonial_count: 100n }]);
  });
  it('enforces a durable three-attempt budget and keeps ETL facts after statistics failures', async () => {
    await cut('2025-01-01Z'); await jobs.discover();
    for (let attempt = 1; attempt <= 3; attempt++) {
      const lease = (await jobs.claim())!; expect(lease).toBeTruthy(); await jobs.fail(lease, 'BI_STATISTICS_FAILED');
    }
    expect(await jobs.claim()).toBeNull();
    expect(await admin.$queryRaw`SELECT attempt_count, status FROM etl.statistics_jobs`).toEqual([{ attempt_count: 3, status: 'failed' }]);
    expect(await read.$queryRaw`SELECT count(*) AS n FROM dw.fact_tenant_snapshot`).toEqual([{ n: 1n }]);
  });
  it('recovers expired reservations with a new token and rejects stale owners', async () => {
    await cut('2025-01-01Z'); await jobs.discover(); const old = (await jobs.claim())!; const report = await payload(old);
    await expire(old); expect(await jobs.heartbeat(old)).toBe(false);
    const next = (await jobs.claim())!; expect(next.token).not.toBe(old.token);
    await expect(jobs.publish(old, report)).rejects.toMatchObject({ code: 'BI_STATISTICS_LEASE_LOST' });
    expect(await jobs.fail(old, 'BI_STATISTICS_FAILED')).toBe(0);
    expect(await jobs.publish(next, await payload(next))).toBe('succeeded');
  });
  it('renews only its live token and caps the lease at the original deadline', async () => {
    await cut('2025-01-01Z'); await jobs.discover(); const lease = (await jobs.claim())!;
    expect(await jobs.heartbeat({ ...lease, token: randomUUID() })).toBe(false);
    expect(await jobs.heartbeat(lease)).toBe(true);
    expect(await admin.$queryRaw`SELECT lease_until = deadline_at AS capped,
      deadline_at = claimed_at + interval '60 seconds' AS bounded FROM etl.statistics_jobs`)
      .toEqual([{ capped: true, bounded: true }]);
  });
  it('rolls back report, pointer and completion if the calculation deadline has passed', async () => {
    await cut('2025-01-01Z'); await jobs.discover(); const lease = (await jobs.claim())!; const report = await payload(lease);
    await expect(jobs.publish({ ...lease, deadline: Date.now() - 1 }, report))
      .rejects.toMatchObject({ code: 'BI_STATISTICS_DEADLINE_EXCEEDED' });
    expect(await read.$queryRaw`SELECT count(*) AS n FROM dw.statistics_publication`).toEqual([{ n: 0n }]);
    expect(await read.$queryRaw`SELECT count(*) AS n FROM dw.statistics_current`).toEqual([{ n: 0n }]);
    expect(await admin.$queryRaw`SELECT status FROM etl.statistics_jobs`).toEqual([{ status: 'running' }]);
  });
  it('rejects invalid report states and reports anchored to a different source cut', async () => {
    await cut('2025-01-01Z'); await jobs.discover(); const lease = (await jobs.claim())!; const report = await payload(lease);
    const invalid = structuredClone(report); invalid.anomalies.items[0]!.numerator = '1';
    await expect(jobs.publish(lease, invalid)).rejects.toMatchObject({ code: 'BI_STATISTICS_DATA_INVALID' });
    const wrongMonth = structuredClone(report); wrongMonth.forecast.targetMonth = '2025-03';
    await expect(jobs.publish(lease, wrongMonth)).rejects.toMatchObject({ code: 'BI_STATISTICS_DATA_INVALID' });
    expect(await jobs.succeeded(lease)).toBe(false);
    expect(await read.$queryRaw`SELECT count(*) AS n FROM dw.statistics_publication`).toEqual([{ n: 0n }]);
  });
  it('supersedes pending obsolete cuts and never moves the pointer back during an older replay', async () => {
    const first = await cut('2025-01-01Z'); await jobs.discover();
    const second = await cut('2025-01-02Z'); await jobs.discover();
    const lease = (await jobs.claim())!; expect(lease.sourceRunId).toBe(second);
    expect(await admin.$queryRaw`SELECT status FROM etl.statistics_jobs WHERE source_run_id = ${first}::uuid`).toEqual([{ status: 'superseded' }]);
    const report = await payload(lease); await jobs.publish(lease, report);
    const third = await cut('2025-01-03Z'); await jobs.discover(); const next = (await jobs.claim())!; await jobs.publish(next, await payload(next));
    await jobs.publish(lease, report);
    expect(await read.$queryRaw`SELECT source_run_id FROM dw.statistics_current`).toEqual([{ source_run_id: third }]);
  });
  it('rolls publication back if pointer update fails, preserving the previous report and base ETL', async () => {
    const first = await cut('2025-01-01Z'); await jobs.discover(); const old = (await jobs.claim())!; await jobs.publish(old, await payload(old));
    const second = await cut('2025-01-02Z'); await jobs.discover(); const lease = (await jobs.claim())!;
    await admin.$executeRawUnsafe(`REVOKE UPDATE ON dw.statistics_current FROM "${writer}"`);
    try { await expect(jobs.publish(lease, await payload(lease))).rejects.toThrow(); }
    finally { await admin.$executeRawUnsafe(`GRANT UPDATE ON dw.statistics_current TO "${writer}"`); }
    expect(await read.$queryRaw`SELECT source_run_id FROM dw.statistics_current`).toEqual([{ source_run_id: first }]);
    expect(await read.$queryRaw`SELECT source_run_id FROM dw.statistics_publication WHERE source_run_id = ${second}::uuid`).toEqual([]);
    expect(await jobs.succeeded(lease)).toBe(false);
    expect(await admin.$queryRaw`SELECT status FROM etl.runs WHERE id = ${second}::uuid`).toEqual([{ status: 'succeeded' }]);
  });
  it('resolves an ambiguous post-COMMIT response from a real publication without another attempt', async () => {
    await cut('2025-01-01Z');
    class LostResponse extends StatisticsJobRepository {
      override async publish(...args: Parameters<StatisticsJobRepository['publish']>): ReturnType<StatisticsJobRepository['publish']> {
        await super.publish(...args); throw new Error('Synthetic response lost after COMMIT');
      }
    }
    expect(await new StatisticsService(new LostResponse(write), inputs).tick(new AbortController().signal)).toEqual({ status: 'succeeded' });
    expect(await admin.$queryRaw`SELECT attempt_count, status FROM etl.statistics_jobs`).toEqual([{ attempt_count: 1, status: 'succeeded' }]);
  });
  it('keeps later discoveries out of earlier evaluation inputs', async () => {
    await cut('2024-06-01Z'); const october = await cut('2024-10-01Z');
    const late = randomUUID();
    await admin.$executeRaw`INSERT INTO dw.dim_testimonial VALUES (${tenant}::uuid, ${late}::uuid, true)`;
    await admin.$executeRaw`INSERT INTO dw.fact_testimonial_snapshot
      (tenant_id, run_id, testimonial_id, category_key, status_code, rating, score, created_at, has_image, has_video, snapshot_at, snapshot_date_key)
      SELECT ${tenant}::uuid, ${october}::uuid, ${late}::uuid, category_key, 'published', 5, 0, '2024-03-01Z', false, false,
        '2024-10-01Z', '2024-10-01' FROM dw.dim_category WHERE tenant_id = ${tenant}::uuid`;
    await admin.$executeRaw`UPDATE dw.fact_tenant_snapshot SET testimonial_count = 101 WHERE tenant_id = ${tenant}::uuid AND run_id = ${october}::uuid`;
    await admin.$executeRaw`UPDATE etl.runs SET source_testimonial_count = 101, snapshot_row_count = 101 WHERE tenant_id = ${tenant}::uuid AND id = ${october}::uuid`;
    await admin.$executeRaw`INSERT INTO dw.fact_testimonial_creation VALUES (${tenant}::uuid, ${late}::uuid, '2024-03-01Z', '2024-10-01Z', '2024-10-01', ${october}::uuid)`;
    await cut('2025-01-15Z', tenant, 101); await jobs.discover(); const lease = (await jobs.claim())!;
    const input = await inputs.read(lease);
    expect(input.forecast.months.find(row => row.month === '2024-03')!.count).toBe(1n);
    expect(input.forecast.origins.find(row => row.targetMonth === '2024-07'))
      .toMatchObject({ originAt: new Date('2024-06-01Z'), counts: [0n, 0n, 0n] });
  });
  it('selects the last cut per day and identifies the rejection jump with a complete baseline', async () => {
    for (let day = 1; day <= 22; day++) await cut(`2025-01-${String(day).padStart(2, '0')}T00:00:00Z`, tenant, 100, day === 22 ? 15 : 10, 10);
    const last = await cut('2025-01-22T12:00:00Z', tenant, 100, 16, 10);
    expect(await service.tick(new AbortController().signal)).toEqual({ status: 'succeeded' });
    const [published] = await read.$queryRaw<Array<{ payload: unknown }>>`SELECT payload FROM dw.statistics_publication WHERE source_run_id = ${last}::uuid`;
    const report = statisticsPayloadSchema.parse(published!.payload);
    expect(report.anomalies.items.find(row => row.id === 'rejected_share:2025-01-22'))
      .toMatchObject({ status: 'flagged', ratio: 0.16, baselineDays: 21, threshold: 0.15 });
    expect(report.anomalies.items.filter(row => row.id === 'rejected_share:2025-01-22')).toHaveLength(1);
  });
  it('distinguishes legacy tag absence and rejects uninitialized or cross-tenant sources', async () => {
    await cut('2025-01-01Z', tenant, 100, 0, 0, false); await jobs.discover(); const lease = (await jobs.claim())!;
    expect((await payload(lease)).patterns.tagsAvailability).toMatchObject({ reason: 'TAGS_NOT_OBSERVED' });
    await expect(inputs.read({ ...lease, tenantId: other })).rejects.toMatchObject({ code: 'BI_STATISTICS_DATA_INVALID' });
    await admin.$executeRaw`DELETE FROM dw.statistics_history_state WHERE tenant_id = ${tenant}::uuid`;
    await expect(inputs.read(lease)).rejects.toMatchObject({ code: 'BI_STATISTICS_DATA_INVALID' });
  });
  function publishedReads() {
    return new StatisticsReadRepository({ read: work => read.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL timezone = 'UTC'`;
      return work(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }) });
  }
  it('reads published statistics from DW only, isolates tenants and retains old reports after a new cut', async () => {
    const first = await cut('2025-01-01Z'); await cut('2025-01-01Z', other, 2);
    await service.tick(new AbortController().signal); await service.tick(new AbortController().signal);
    const reads = publishedReads();
    expect((await reads.read(tenant)).payload?.patterns.totalTestimonials).toBe('100');
    expect((await reads.read(other)).payload?.patterns.totalTestimonials).toBe('2');
    expect(await reads.read(randomUUID())).toMatchObject({ latestRunId: null, publication: null, payload: null });
    const latest = await cut('2025-01-02Z');
    expect(await reads.read(tenant)).toMatchObject({ latestRunId: latest, publication: { sourceRunId: first } });
  });
  it('reports pending calculation without inventing counts and rejects invalid persisted JSON', async () => {
    await cut('2025-01-01Z'); const reads = publishedReads();
    expect(await reads.read(tenant)).toMatchObject({ publication: null, payload: null });
    await service.tick(new AbortController().signal);
    await admin.$executeRaw`UPDATE dw.statistics_publication SET payload = jsonb_set(payload, '{forecast,value}', '"invalid"'::jsonb) WHERE tenant_id = ${tenant}::uuid`;
    await expect(reads.read(tenant)).rejects.toMatchObject({ code: 'BI_STATISTICS_UNAVAILABLE' });
    expect(await read.$queryRaw`SELECT testimonial_count FROM dw.fact_tenant_snapshot WHERE tenant_id = ${tenant}::uuid`).toEqual([{ testimonial_count: 100n }]);
  });
  it('isolates missing statistics permissions from base inventory reads', async () => {
    await cut('2025-01-01Z');
    await admin.$executeRawUnsafe(`REVOKE SELECT ON dw.statistics_publication FROM "${reader}"`);
    try { await expect(publishedReads().read(tenant)).rejects.toMatchObject({ code: 'BI_STATISTICS_UNAVAILABLE' }); }
    finally { await admin.$executeRawUnsafe(`GRANT SELECT ON dw.statistics_publication TO "${reader}"`); }
    expect(await read.$queryRaw`SELECT testimonial_count FROM dw.fact_tenant_snapshot WHERE tenant_id = ${tenant}::uuid`).toEqual([{ testimonial_count: 100n }]);
  });
  it('fails optional engine preflight safely with missing permissions', async () => {
    expect(await statisticsEngineReady(write, true)).toBe(true);
    await admin.$executeRawUnsafe(`REVOKE INSERT ON dw.statistics_publication FROM "${writer}"`);
    try { expect(await statisticsEngineReady(write, true)).toBe(false); }
    finally { await admin.$executeRawUnsafe(`GRANT INSERT ON dw.statistics_publication TO "${writer}"`); }
  });
});
