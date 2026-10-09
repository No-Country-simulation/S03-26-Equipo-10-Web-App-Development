/** Manual benchmark. TWO disposable admin servers and generated Prisma DDL only; never a deployed database. */
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { cpus, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaClient } from '@prisma/client';
import { migrationStatements } from '../src/modules/business-intelligence/repositories/warehouse-migrations';
import { installBiWarehouse } from './fixtures/bi-warehouse';
import { SourceRepository } from '../src/modules/business-intelligence/repositories/source.repository';
import { WarehouseRepository } from '../src/modules/business-intelligence/repositories/warehouse.repository';
import { EtlService } from '../src/modules/business-intelligence/services/etl.service';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { RedisStoreService } from '../src/common/services/redis-store.service';

async function main() {
  const sourceUrl = process.env.TEST_BI_SOURCE_DATABASE_URL;
  const targetUrl = process.env.TEST_BI_WAREHOUSE_DATABASE_URL;
  const ddlPath = process.env.TEST_BI_BENCHMARK_SCHEMA_FILE;
  if (process.argv[2] !== '--run' || !sourceUrl || !targetUrl || !ddlPath) throw new Error('BI_BENCH_CONFIGURATION');
  const suffix = randomUUID().replaceAll('-', '');
  const sourceDb = `bi_bench_source_${suffix}`; const targetDb = `bi_bench_dw_${suffix}`;
  const parentSource = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
  const parentTarget = new PrismaClient({ datasources: { db: { url: targetUrl } } });
  function connection(url: string, db: string, limit: number) {
    const parsed = new URL(url); parsed.pathname = `/${db}`; parsed.searchParams.set('connection_limit', String(limit)); return parsed.toString();
  }
  const source = new PrismaClient({ datasources: { db: { url: connection(sourceUrl, sourceDb, 1) } } });
  const target = new PrismaClient({ datasources: { db: { url: connection(targetUrl, targetDb, 2) } } });
  let app: INestApplication | undefined;
  let stage = 'setup';
  try {
    await parentSource.$executeRawUnsafe(`CREATE DATABASE "${sourceDb}"`);
    await parentTarget.$executeRawUnsafe(`CREATE DATABASE "${targetDb}"`);
    // Explicit local benchmark input, never an HTTP path.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const schema = await readFile(ddlPath, 'utf8');
    for (const sql of migrationStatements(schema)) await source.$executeRawUnsafe(sql);
    const views = await readFile('prisma/migrations/20261008010000_bi_export_views/migration.sql', 'utf8');
    for (const sql of migrationStatements(views)) await source.$executeRawUnsafe(sql);
    await installBiWarehouse(target);
    const status = await source.testimonialStatus.createMany({ data: ['draft', 'pending', 'approved', 'published', 'rejected'].map(code => ({ code })) });
    if (status.count !== 5) throw new Error('BI_BENCH_SEED');
    const role = await source.role.create({ data: { code: 'admin' } });
    const flag = await source.featureFlag.create({ data: { name: 'testimonials' } });
    const companies = [];
    for (let i = 0; i < 3; i++) {
      const tenant = await source.tenant.create({ data: { name: `Synthetic company ${i}` } }); companies.push(tenant.id);
      await source.tenantFeatureFlag.create({ data: { tenantId: tenant.id, featureFlagId: flag.id } });
      await source.$executeRaw`INSERT INTO testimonials (id, tenant_id, content, author_name, rating, status_id, created_at, updated_at, published_at)
        SELECT gen_random_uuid(), ${tenant.id}::uuid, 'Synthetic benchmark testimonial', 'Synthetic author', 1 + g % 5,
          CASE WHEN g <= 500 THEN 2 ELSE 4 END, '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z',
          CASE WHEN g > 500 THEN '2024-01-02T00:00:00Z'::timestamptz ELSE NULL END FROM generate_series(1, 4000) g`;
    }
    await source.analyticsEventType.createMany({ data: ['view', 'click', 'play'].map(code => ({ code })) });
    for (const tenantId of companies) {
      await source.$executeRaw`INSERT INTO analytics_events (tenant_id, testimonial_id, event_type_id, source, created_at)
        SELECT ${tenantId}::uuid, t.id, 1 + g % 3, 'widget', '2024-02-29T23:59:59.999Z'
        FROM testimonials t CROSS JOIN generate_series(1, 5) g WHERE t.tenant_id = ${tenantId}::uuid`;
    }
    const tenantId = companies[0]!;
    const user = await source.user.create({ data: { tenantId, email: `synthetic-${suffix}@example.test`, passwordHash: 'synthetic-not-used', roles: { create: { roleId: role.id } } } });
    const pending = await source.testimonial.findMany({ where: { tenantId, statusId: 2 }, select: { id: true }, orderBy: { id: 'asc' } });
    await source.$executeRawUnsafe('ANALYZE');
    const [plan] = await source.$queryRaw<Array<{ 'QUERY PLAN': unknown }>>`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
      SELECT event_id FROM bi_export.analytics_events WHERE tenant_id = ${tenantId}::uuid AND event_id > 0 ORDER BY event_id LIMIT 1000`;
    process.env.NODE_ENV = 'test'; process.env.DATABASE_URL = connection(sourceUrl, sourceDb, 8);
    process.env.JWT_SECRET = randomBytes(32).toString('hex'); process.env.API_KEY_PEPPERS_JSON = JSON.stringify({ 1: randomBytes(32).toString('base64url') });
    process.env.WEBHOOK_SECRET_KEYS_JSON = ''; process.env.BI_ENABLED = 'false';
    process.env.REDIS_URL = 'redis://127.0.0.1:1';
    const { AppModule } = await import('../src/app.module');
    const createApi = async () => {
      const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(RedisStoreService)
        .useValue({ connection: async () => ({ eval: async () => 0, get: async () => null, set: async () => 'OK', incr: async () => 1 }) }).compile();
      const instance = module.createNestApplication({ logger: false }); instance.setGlobalPrefix('api/v1');
      instance.useGlobalPipes(new ZodValidationPipe()); instance.useGlobalFilters(new ApiExceptionFilter()); instance.useGlobalInterceptors(new ApiResponseInterceptor());
      await instance.listen(0, '127.0.0.1'); return instance;
    };
    app = await createApi();
    const token = app.get(JwtService).sign({ sub: user.id, tenantId }, { secret: process.env.JWT_SECRET });
    const base = await app.getUrl();
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const captured: string[] = [];
    const routes = ['/testimonials?limit=20', '/analytics/dashboard', '/testimonials', '/testimonials/:id/approve'];
    async function workload(durationMs: number, overlapping?: () => boolean) {
      const samples: number[][] = [[], [], [], []]; const errors = new Map<number, number>(); let counter = 0; let overlap = 0;
      const started = performance.now(); const cpuStarted = process.cpuUsage();
      await Promise.all(Array.from({ length: 4 }, async () => {
        while (performance.now() - started < durationMs) {
          const iteration = counter++; const kind = iteration % 4;
          if (kind === 3 && iteration / 4 >= pending.length) continue;
          const path = kind === 3 ? `/testimonials/${pending.at(Math.floor(iteration / 4))!.id}/approve` : routes.at(kind)!;
          const at = performance.now(); if (overlapping?.()) overlap++;
          const response = await fetch(`${base}/api/v1${path}`, { method: kind < 2 ? 'GET' : 'POST', headers,
            ...(kind === 2 ? { body: JSON.stringify({ authorName: 'Synthetic author', content: 'Synthetic benchmark capture', rating: 5 }) } : {}) });
          const body = await response.json() as { data?: { id?: string } };
          samples.at(kind)!.push(performance.now() - at); if (!response.ok) errors.set(kind, (errors.get(kind) ?? 0) + 1);
          if (kind === 2 && body.data?.id) captured.push(body.data.id);
        }
      }));
      const cpu = process.cpuUsage(cpuStarted);
      return { durationMs: performance.now() - started, overlapRequests: overlap, nodeCpuMs: (cpu.user + cpu.system) / 1000,
        nodeRssBytes: process.memoryUsage().rss, routes: samples.map((times, index) => {
          times.sort((a, b) => a - b); return { route: routes.at(index), requests: times.length, errors: errors.get(index) ?? 0,
            p95Ms: times.length ? times.at(Math.min(times.length - 1, Math.ceil(times.length * .95) - 1)) ?? null : null,
            p99Ms: times.length ? times.at(Math.min(times.length - 1, Math.ceil(times.length * .99) - 1)) ?? null : null }; }) };
    }
    const io = () => source.$queryRaw<Array<{ hits: bigint; reads: bigint; writes: bigint }>>`SELECT sum(blks_hit)::bigint AS hits,
      sum(blks_read)::bigint AS reads, sum(temp_bytes)::bigint AS writes FROM pg_stat_database WHERE datname = current_database()`;
    const tickMs = 1000 / Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim());
    async function postgresCpu() {
      const pids = await source.$queryRaw<Array<{ pid: number }>>`SELECT pid FROM pg_stat_activity WHERE datname = current_database()`;
      const samples = await Promise.all(pids.map(async ({ pid }) => {
        // PostgreSQL-generated local PID, not user input; Linux benchmark instrumentation only.
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const stat = await readFile(`/proc/${pid}/stat`, 'utf8');
        const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
        return (Number(fields[11]) + Number(fields[12])) * tickMs;
      }));
      return samples.reduce((total, ms) => total + ms, 0);
    }
    // Warm-up then identical duration/concurrency; resets writes and pending statuses between rounds.
    await fetch(`${base}/api/v1/testimonials?limit=20`, { headers });
    stage = 'baseline'; const [ioStart] = await io(); const cpuStart = await postgresCpu(); const baseline = await workload(8000); const [ioBaseline] = await io();
    const baselinePostgresCpuMs = await postgresCpu() - cpuStart;
    await source.testimonial.deleteMany({ where: { tenantId, id: { in: captured } } }); captured.length = 0;
    await source.testimonial.updateMany({ where: { tenantId, id: { in: pending.map(row => row.id) } }, data: { statusId: 2 } });
    await source.outboxEvent.deleteMany({ where: { tenantId } });
    stage = 'with_etl'; const [ioWithStart] = await io(); const cpuWithStart = await postgresCpu(); const phases: unknown[] = []; let loading = true;
    const etlAt = performance.now(); let etlCycleMs = 0;
    const etl = (async () => { const results = []; for await (const result of new EtlService(new SourceRepository(source), new WarehouseRepository(target), event => phases.push(event)).cycle()) results.push(result);
      return results.map(result => ({ status: result.status, code: result.code })); })().finally(() => { loading = false; etlCycleMs = performance.now() - etlAt; });
    const [withEtl, results] = await Promise.all([workload(8000, () => loading), etl]);
    const withEtlPostgresCpuMs = await postgresCpu() - cpuWithStart;
    const [ioAfter] = await io();
    const [snapshotTime] = await target.$queryRaw<Array<{ maxMs: number }>>`SELECT max(extract(epoch FROM finished_at - started_at) * 1000)::float8 AS "maxMs" FROM etl.runs`;
    stage = 'olap_failure'; await app.close(); app = undefined;
    process.env.BI_ENABLED = 'true'; process.env.BI_DATABASE_URL = connection(targetUrl, `absent_${suffix}`, 2);
    app = await createApi(); const secondBase = await app.getUrl();
    const statuses = new Map<string, number>();
    for (const route of ['/bi/dashboard', '/health/live', '/health/ready', '/testimonials?limit=20']) {
      statuses.set(route, (await fetch(`${secondBase}/api/v1${route}`, { headers })).status);
    }
    const stringifyStats = (row: typeof ioStart) => row ? { sharedHits: row.hits.toString(), sharedReads: row.reads.toString(), tempBytes: row.writes.toString() } : null;
    const report = { generatedAt: new Date().toISOString(), node: process.version, postgres: '18.6', hostCpuLogical: cpus().length,
      hostMemoryBytes: totalmem(), dataset: { tenants: 3, testimonials: 12000, events: 60000 }, concurrency: 4, roundMs: 8000,
      postgresSettings: { sharedBuffers: '32MB', sourceMaxConnections: 30, targetMaxConnections: 20 }, pools: { api: 8, extraction: 1, publication: 2 },
      limitations: ['same physical host; no resource isolation certificate', 'synthetic data and warm cache', 'Redis quotas/cache replaced by a test adapter',
        'DDL generated from Prisma plus export views, not the full historical migration chain', 'PostgreSQL block counters are not physical disk IO', 'no agreed production SLO'],
      baseline: { ...baseline, postgresBackendCpuMs: baselinePostgresCpuMs }, withEtl: { ...withEtl, postgresBackendCpuMs: withEtlPostgresCpuMs },
      etl: { statuses: results, cycleMs: etlCycleMs, maxTenantRunMs: snapshotTime?.maxMs, phases },
      ioCumulative: { start: stringifyStats(ioStart), baseline: stringifyStats(ioBaseline), withEtlStart: stringifyStats(ioWithStart), afterEtl: stringifyStats(ioAfter) },
      extractionPlan: plan?.['QUERY PLAN'], olapUnavailableHttp: Object.fromEntries(statuses) };
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } catch { process.stderr.write(JSON.stringify({ code: 'BI_BENCH_FAILED', stage }) + '\n'); process.exitCode = 1; }
  finally {
    await app?.close(); await Promise.allSettled([source.$disconnect(), target.$disconnect()]);
    await parentSource.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${sourceDb}" WITH (FORCE)`);
    await parentTarget.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${targetDb}" WITH (FORCE)`);
    await Promise.allSettled([parentSource.$disconnect(), parentTarget.$disconnect()]);
  }
}
void main().catch(() => { process.stderr.write('BI_BENCH_FAILED\n'); process.exitCode = 1; });
