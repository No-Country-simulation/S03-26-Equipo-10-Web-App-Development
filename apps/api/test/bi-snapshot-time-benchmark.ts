/** Manual benchmark: disposable PostgreSQL admin URL only; random databases removed in finally. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { cpus, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import { Prisma, PrismaClient } from '@prisma/client';
import { BiConnection } from '../src/modules/business-intelligence/repositories/bi-connection';
import { DashboardRepository } from '../src/modules/business-intelligence/repositories/dashboard.repository';
import { WarehouseRepository } from '../src/modules/business-intelligence/repositories/warehouse.repository';
import { SnapshotTimeBackfillRepository } from '../src/modules/business-intelligence/repositories/snapshot-time-backfill.repository';
import { applyWarehouseMigration } from '../src/modules/business-intelligence/repositories/warehouse-migrations';
import { hourUtc } from '../src/modules/business-intelligence/etl.types';
import { LegacyDashboardRepository } from './fixtures/bi-dashboard-legacy';
import { LegacyWarehouseRepository } from './fixtures/bi-warehouse-legacy';

function stats(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { samples: sorted.length, p50Ms: sorted[Math.ceil(sorted.length * .5) - 1],
    p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], p99Ms: sorted[Math.ceil(sorted.length * .99) - 1] };
}
class CaptureConnection extends BiConnection {
  readonly queries: Prisma.Sql[] = [];
  override read<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return super.read(tx => work(new Proxy(tx, { get: (target, key, receiver) => {
      if (key === '$queryRaw') return (query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => {
        const sql = Array.isArray(query) ? Prisma.sql(query as TemplateStringsArray, ...values) : query as Prisma.Sql;
        this.queries.push(sql); return tx.$queryRaw(sql);
      };
      return Reflect.get(target, key, receiver) as unknown;
    } })));
  }
}

async function main() {
  const url = process.env.TEST_BI_WAREHOUSE_DATABASE_URL;
  if (process.argv.length !== 3 || process.argv[2] !== '--run' || !url) throw new Error('BI_BENCH_CONFIGURATION');
  const suffix = randomUUID().replaceAll('-', '');
  const database = `bi_time_${suffix}`; const baselineDb = `bi_time_legacy_${suffix}`;
  const parent = new PrismaClient({ datasources: { db: { url } }, log: [] });
  function connection(db: string) {
    const parsed = new URL(url!); parsed.pathname = `/${db}`; parsed.searchParams.set('connection_limit', '2'); return parsed.toString();
  }
  const client = new PrismaClient({ datasources: { db: { url: connection(database) } }, log: [] });
  const legacyClient = new PrismaClient({ datasources: { db: { url: connection(baselineDb) } }, log: [] });
  const readers: BiConnection[] = [];
  const tenants = Array.from({ length: 3 }, (_, i) => ({ id: randomUUID(), i }));
  let stage = 'setup';
  async function migrate(version: string) {
    // Repository-owned filename, not a CLI argument.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return applyWarehouseMigration(client, version, await readFile(`warehouse/migrations/${version}`, 'utf8'));
  }
  async function size() {
    return client.$queryRaw<Array<{ table: string; heapBytes: string; indexesBytes: string; totalBytes: string }>>`
      SELECT relname AS table, pg_table_size(c.oid)::text AS "heapBytes", pg_indexes_size(c.oid)::text AS "indexesBytes",
        pg_total_relation_size(c.oid)::text AS "totalBytes" FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'dw' AND relname IN ('fact_testimonial_snapshot', 'fact_tenant_snapshot') ORDER BY relname`;
  }
  const normalize = (result: Awaited<ReturnType<DashboardRepository['dashboard']>>) => ({ ...result,
    freshness: { ...result.freshness, dataAgeSeconds: null } });
  try {
    await parent.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
    await migrate('0001_initial.sql');
    stage = 'seed';
    await client.$executeRaw`INSERT INTO dw.dim_tenant (tenant_id, name, is_active)
      SELECT id, 'Synthetic company ' || i, true FROM jsonb_to_recordset(${JSON.stringify(tenants)}::jsonb) AS x(id uuid, i int)`;
    await client.$executeRaw`INSERT INTO dw.dim_status VALUES ('draft'), ('published')`;
    await client.$executeRaw`INSERT INTO dw.dim_testimonial (tenant_id, testimonial_id)
      SELECT tenant_id, md5(tenant_id::text || g)::uuid FROM dw.dim_tenant CROSS JOIN generate_series(1, 1000) g`;
    await client.$executeRaw`INSERT INTO dw.dim_category (tenant_id, source_category_id, name)
      SELECT tenant_id, CASE WHEN g = 0 THEN NULL ELSE md5(tenant_id::text || 'category' || g)::uuid END,
        CASE WHEN g = 0 THEN 'Sin categoría' ELSE 'Synthetic category ' || g END
      FROM dw.dim_tenant CROSS JOIN generate_series(0, 3) g`;
    await client.$executeRaw`INSERT INTO etl.runs (id, tenant_id, slot_at, attempt_no, status, started_at, source_snapshot_at, finished_at,
      source_testimonial_count, snapshot_row_count)
      SELECT md5(t.id::text || 'run' || g)::uuid, t.id, '2024-02-27Z'::timestamptz + g * interval '3 hours', 1, 'succeeded',
        '2024-02-27Z'::timestamptz + g * interval '3 hours', '2024-02-27Z'::timestamptz + g * interval '3 hours' + interval '1 minute',
        '2024-02-27Z'::timestamptz + g * interval '3 hours' + interval '2 minutes',
        CASE WHEN t.i = 2 OR t.i = 0 AND g % 8 = 7 THEN 0 ELSE 1000 END,
        CASE WHEN t.i = 2 OR t.i = 0 AND g % 8 = 7 THEN 0 ELSE 1000 END
      FROM jsonb_to_recordset(${JSON.stringify(tenants)}::jsonb) AS t(id uuid, i int) CROSS JOIN generate_series(0, 55) g
      WHERE NOT (t.i = 0 AND g BETWEEN 24 AND 31)`;
    await client.$executeRaw`INSERT INTO dw.fact_testimonial_snapshot
      (tenant_id, run_id, testimonial_id, category_key, status_code, rating, score, created_at, has_image, has_video)
      SELECT r.tenant_id, r.id, md5(r.tenant_id::text || g)::uuid, c.category_key,
        CASE WHEN g % 5 = 0 THEN 'draft' ELSE 'published' END, 1 + g % 5, 42.1234, '2024-01-01Z', g % 2 = 0, g % 3 = 0
      FROM etl.runs r CROSS JOIN LATERAL generate_series(1, r.snapshot_row_count::int) g
      JOIN dw.dim_category c ON c.tenant_id = r.tenant_id
        AND c.source_category_id IS NOT DISTINCT FROM CASE WHEN g % 4 = 0 THEN NULL ELSE md5(r.tenant_id::text || 'category' || g % 4)::uuid END`;
    await client.$executeRaw`INSERT INTO etl.tenant_load_state (tenant_id, last_published_run_id)
      SELECT DISTINCT ON (tenant_id) tenant_id, id FROM etl.runs ORDER BY tenant_id, source_snapshot_at DESC`;
    await client.$executeRaw`INSERT INTO dw.dim_date (date_key) SELECT generate_series('2024-02-27'::timestamp, '2024-03-04', '1 day')::date`;
    await client.$executeRaw`INSERT INTO dw.dim_event_type (code) VALUES ('view'), ('click'), ('play')`;
    await client.$executeRaw`INSERT INTO dw.dim_source (tenant_id, code) SELECT tenant_id, 'widget' FROM dw.dim_tenant`;
    await client.$executeRaw`INSERT INTO dw.fact_engagement_daily
      (tenant_id, testimonial_id, date_key, source_key, event_type_key, event_count, last_reconciled_run_id)
      SELECT t.id, md5(t.id::text || g)::uuid, d.date_key, s.source_key, k.event_type_key, 1 + g % 5, l.last_published_run_id
      FROM jsonb_to_recordset(${JSON.stringify(tenants)}::jsonb) AS t(id uuid, i int) CROSS JOIN generate_series(1, 100) g
      CROSS JOIN dw.dim_date d CROSS JOIN dw.dim_event_type k JOIN dw.dim_source s ON s.tenant_id = t.id
      JOIN etl.tenant_load_state l ON l.tenant_id = t.id WHERE t.i < 2`;
    await client.$executeRawUnsafe('ANALYZE');
    const before = await size();
    const dataset = await client.$queryRaw`SELECT (SELECT count(*) FROM dw.dim_tenant)::text AS tenants,
      (SELECT count(*) FROM etl.runs)::text AS cuts, (SELECT count(*) FROM dw.fact_testimonial_snapshot)::text AS details,
      (SELECT count(*) FROM dw.fact_engagement_daily)::text AS engagement`;
    await client.$disconnect();
    await parent.$executeRawUnsafe(`CREATE DATABASE "${baselineDb}" TEMPLATE "${database}"`);
    stage = 'backfill';
    const expandedAt = performance.now(); await migrate('0002_snapshot_time_expand.sql'); const expandMs = performance.now() - expandedAt;
    const batches: number[] = []; let batchAt = performance.now(); const started = batchAt;
    await new SnapshotTimeBackfillRepository(client).apply({ afterBatch: () => { const now = performance.now(); batches.push(now - batchAt); batchAt = now; } });
    const backfillMs = performance.now() - started;
    const closedAt = performance.now(); await migrate('0003_snapshot_time_constraints.sql'); const closeMs = performance.now() - closedAt;
    await client.$executeRawUnsafe('VACUUM (ANALYZE) dw.fact_testimonial_snapshot');
    await client.$executeRawUnsafe('ANALYZE dw.fact_tenant_snapshot');
    const after = await size();
    const previousEnabled = process.env.BI_ENABLED; const previousUrl = process.env.BI_DATABASE_URL;
    let read: BiConnection; let captured: CaptureConnection;
    try {
      process.env.BI_ENABLED = 'true'; process.env.BI_DATABASE_URL = connection(database);
      read = new BiConnection(); captured = new CaptureConnection(); readers.push(read, captured);
    } finally {
      if (previousEnabled === undefined) delete process.env.BI_ENABLED; else process.env.BI_ENABLED = previousEnabled;
      if (previousUrl === undefined) delete process.env.BI_DATABASE_URL; else process.env.BI_DATABASE_URL = previousUrl;
    }
    stage = 'parity';
    const legacy = new LegacyDashboardRepository(read); const current = new DashboardRepository(read);
    const range = { from: '2024-02-27', to: '2024-03-04', timezone: 'UTC' as const };
    for (const tenant of tenants) assert.deepEqual(normalize(await current.dashboard(tenant.id, range)), normalize(await legacy.dashboard(tenant.id, range)));
    stage = 'warmup';
    for (let i = 0; i < 5; i++) for (const t of tenants) { await legacy.dashboard(t.id, range); await current.dashboard(t.id, range); }
    const legacyTimes: number[] = []; const currentTimes: number[] = [];
    stage = 'timings';
    for (let i = 0; i < 100; i++) for (const t of tenants) {
      for (const version of i % 2 ? ['current', 'legacy'] : ['legacy', 'current']) {
        const at = performance.now(); await (version === 'legacy' ? legacy : current).dashboard(t.id, range);
        (version === 'legacy' ? legacyTimes : currentTimes).push(performance.now() - at);
      }
    }
    stage = 'capture';
    await new LegacyDashboardRepository(captured).dashboard(tenants[1]!.id, range);
    await new DashboardRepository(captured).dashboard(tenants[1]!.id, range);
    const explain = async (queries: Prisma.Sql[]) => Promise.all(queries.map(query => client.$queryRaw(
      Prisma.sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`)));
    stage = 'plans'; const plans = await explain(captured.queries);
    const calendarQuery = Prisma.sql`SELECT count(*) FROM dw.fact_testimonial_snapshot WHERE snapshot_date_key = '2024-02-29'::date`;
    const calendarPlan = await explain([calendarQuery]);
    stage = 'candidate_indexes';
    const indexAt = performance.now();
    await client.$executeRawUnsafe('CREATE INDEX candidate_cut_time ON dw.fact_tenant_snapshot (tenant_id, snapshot_at DESC, run_id)');
    await client.$executeRawUnsafe('CREATE INDEX candidate_detail_time ON dw.fact_testimonial_snapshot (tenant_id, snapshot_date_key, snapshot_at, run_id)');
    const indexBuildMs = performance.now() - indexAt;
    const candidateSizes = await size(); const candidatePlans = await explain(captured.queries.slice(7));
    const calendarCandidatePlan = await explain([calendarQuery]);
    const indexedTimes: number[] = [];
    for (let i = 0; i < 100; i++) for (const t of tenants) { const at = performance.now(); await current.dashboard(t.id, range); indexedTimes.push(performance.now() - at); }
    await client.$executeRawUnsafe('DROP INDEX dw.candidate_cut_time, dw.candidate_detail_time');
    stage = 'publication';
    async function publish(db: PrismaClient, repository: Pick<WarehouseRepository, 'claim' | 'snapshot' | 'testimonials' | 'events' | 'publish'>) {
      const id = randomUUID(); const times: number[] = [];
      const rows = Array.from({ length: 1000 }, (_, i) => ({ tenantId: id, testimonialId: randomUUID(), categoryId: null,
        statusCode: 'published', rating: 1 + i % 5, score: new Prisma.Decimal('42.1234'), createdAt: new Date('2024-01-01Z'),
        publishedAt: null, hasImage: false, hasVideo: false }));
      const [walStart] = await db.$queryRaw<Array<{ lsn: string }>>`SELECT pg_current_wal_insert_lsn()::text AS lsn`;
      for (let i = 0; i < 10; i++) {
        const at = new Date(hourUtc(new Date()).getTime() - (10 - i) * 3600000 + 1000);
        const lease = await repository.claim(id, hourUtc(at)); assert(lease);
        const snapshot = { tenantId: id, name: 'Synthetic publication', isActive: true, at };
        await repository.snapshot(lease, snapshot); await repository.testimonials(lease, rows);
        await repository.events(lease, rows.map((r, j) => ({ tenantId: id, testimonialId: r.testimonialId, eventId: BigInt(j + 1),
          eventTypeCode: 'view', sourceCode: 'widget', createdAt: r.createdAt })));
        const start = performance.now(); await repository.publish(lease, snapshot, { categories: 0n, testimonials: 1000n, events: 1000n });
        times.push(performance.now() - start);
      }
      const [wal] = await db.$queryRaw<Array<{ bytes: string }>>`SELECT pg_wal_lsn_diff(pg_current_wal_insert_lsn(), ${walStart!.lsn}::pg_lsn)::text AS bytes`;
      return { ...stats(times), walBytesIncludingStagingAndControl: wal?.bytes };
    }
    const legacyPublication = await publish(legacyClient, new LegacyWarehouseRepository(legacyClient));
    const currentPublication = await publish(client, new WarehouseRepository(client));
    process.stdout.write(JSON.stringify({ generatedAt: new Date().toISOString(), node: process.version,
      baselineCommit: '085d95b', hardware: { cpu: cpus()[0]?.model, logicalCpus: cpus().length, memoryBytes: totalmem() },
      postgres: await client.$queryRaw`SELECT version(), current_setting('shared_buffers') AS shared_buffers, current_setting('max_connections') AS max_connections`,
      dataset, range, migration: { expandMs, backfillMs, nonemptyBatchIntervals: stats(batches), closeMs },
      storage: { before, after, withCandidateIndexes: candidateSizes },
      dashboard: { legacy: stats(legacyTimes), current: stats(currentTimes), withCandidateIndexes: stats(indexedTimes), parityIgnoringAgeSeconds: true },
      candidateIndexes: { indexBuildMs, persisted: false }, publication: { legacy: legacyPublication, current: currentPublication },
      plans: { legacy: plans.slice(0, 7), current: plans.slice(7), withCandidateIndexes: candidatePlans,
        calendar: calendarPlan, calendarWithCandidateIndexes: calendarCandidatePlan },
      limitations: ['single shared host, warm cache, serial dashboard calls, synthetic history',
        '300 dashboard samples mix 3 tenants including an always-empty tenant; p99 has limited tail precision',
        'publication rounds sequential, 10 samples each on initially equivalent cloned histories; WAL is cluster-wide including staging/control',
        'candidate build and read cost measured, candidate write cost not certified; no candidate indexes persisted',
        'batch intervals include guard/validation and scheduling, not precise lock hold time', 'not a production capacity certificate or SLO'] }, null, 2) + '\n');
  } catch (error) {
    process.stderr.write(JSON.stringify({ code: 'BI_TIME_BENCH_FAILED', stage,
      kind: error instanceof Error ? error.name : 'unknown',
      ...(error instanceof assert.AssertionError ? { difference: error.message } : {}) }) + '\n'); process.exitCode = 1;
  }
  finally {
    await Promise.allSettled(readers.map(r => r.onModuleDestroy()));
    await Promise.allSettled([client.$disconnect(), legacyClient.$disconnect()]);
    for (const db of [baselineDb, database]) await parent.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`);
    await parent.$disconnect();
  }
}
void main().catch(() => { process.stderr.write('BI_TIME_BENCH_FAILED\n'); process.exitCode = 1; });
