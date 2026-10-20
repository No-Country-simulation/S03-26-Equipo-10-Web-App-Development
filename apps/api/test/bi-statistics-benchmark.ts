/** Opt-in local comparison; all DBs/roles are owned fixtures. Never certifies production capacity. */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { cpus, totalmem } from 'node:os';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createBiSystem } from './fixtures/bi-system-environment';
import { StatisticsHistoryRepository } from '../src/modules/business-intelligence/repositories/statistics-history.repository';
import { StatisticsJobRepository } from '../src/modules/business-intelligence/repositories/statistics-job.repository';
import { StatisticsInputRepository } from '../src/modules/business-intelligence/repositories/statistics-input.repository';
import { StatisticsService } from '../src/modules/business-intelligence/services/statistics.service';
import { WorkerControlRepository } from '../src/modules/business-intelligence/repositories/worker-control.repository';

function quantiles(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    samples: sorted.length,
    p50Ms: sorted.at(Math.ceil(sorted.length * 0.5) - 1) ?? null,
    p95Ms: sorted.at(Math.ceil(sorted.length * 0.95) - 1) ?? null,
    p99Ms: sorted.at(Math.ceil(sorted.length * 0.99) - 1) ?? null,
  };
}
class BenchmarkFailure extends Error {
  constructor(readonly evidence: unknown) {
    super('BENCH_ASSERTION');
  }
}
async function mode(statistics: boolean) {
  const progress = (stage: string) =>
    process.stderr.write(
      JSON.stringify({ event: 'bi.statistics_benchmark', statistics, stage }) +
        '\n',
    );
  progress('setup');
  const system = await createBiSystem({ statistics: true }); // Same physical schema/source workload in both modes.
  let child: ReturnType<typeof spawn> | undefined;
  try {
    const tenant = system.users[0]!.company.id;
    await system.source
      .$executeRaw`INSERT INTO testimonials (id, tenant_id, content, author_name, rating, status_id, created_at, updated_at)
      SELECT md5('stats-bench-' || g)::uuid, ${tenant}::uuid, 'Synthetic benchmark content', 'Synthetic fixture', 1 + g % 5, 4,
        (date_trunc('month', now() AT TIME ZONE 'UTC') - ((g % 14) || ' months')::interval) AT TIME ZONE 'UTC', now()
      FROM generate_series(1, 1000) g`;
    await system.source
      .$executeRaw`INSERT INTO tags (id, tenant_id, name, created_at, updated_at)
      SELECT md5('stats-tag-' || g)::uuid, ${tenant}::uuid, 'Synthetic tag ' || g, now(), now() FROM generate_series(1, 50) g`;
    await system.source
      .$executeRaw`INSERT INTO testimonial_tags SELECT t.tenant_id, t.id, tags.id
      FROM testimonials t JOIN tags ON tags.tenant_id = t.tenant_id WHERE t.tenant_id = ${tenant}::uuid`;
    progress('history_preparation');
    const preparation = performance.now();
    // Daily synthetic history. It contains only creations already eligible at each observation; no historical tag reconstruction.
    await system.target
      .$executeRaw`INSERT INTO dw.dim_tenant (tenant_id, name, is_active) VALUES (${tenant}::uuid, 'Synthetic history', true)`;
    await system.target
      .$executeRaw`INSERT INTO dw.dim_status (status_code) VALUES ('published')`;
    await system.target
      .$executeRaw`INSERT INTO dw.dim_category (tenant_id, name) VALUES (${tenant}::uuid, 'Sin categoría')`;
    const sourceRows = await system.source.testimonial.findMany({
      where: { tenantId: tenant },
      select: { id: true, createdAt: true },
    });
    await system.target
      .$executeRaw`INSERT INTO dw.dim_testimonial (tenant_id, testimonial_id)
      SELECT ${tenant}::uuid, id::uuid FROM unnest(${sourceRows.map((row) => row.id)}::text[]) AS id`;
    await system.target.$executeRaw`INSERT INTO dw.dim_date (date_key)
      SELECT (now() AT TIME ZONE 'UTC')::date - g FROM generate_series(1, 425) g`;
    await system.target
      .$executeRaw`INSERT INTO etl.runs (id, tenant_id, slot_at, attempt_no, status, started_at, source_snapshot_at, finished_at,
      source_testimonial_count, snapshot_row_count)
      SELECT md5('stats-cut-' || g)::uuid, ${tenant}::uuid, at, 1, 'succeeded', at - interval '1 second', at, at + interval '1 second',
        (SELECT count(*) FROM unnest(${sourceRows.map((row) => row.createdAt.toISOString())}::timestamptz[]) d WHERE d <= at),
        (SELECT count(*) FROM unnest(${sourceRows.map((row) => row.createdAt.toISOString())}::timestamptz[]) d WHERE d <= at)
      FROM (SELECT g, ((now() AT TIME ZONE 'UTC')::date - g)::timestamp AT TIME ZONE 'UTC' AS at FROM generate_series(1, 425) g) cuts`;
    await system.target
      .$executeRaw`INSERT INTO dw.fact_tenant_snapshot (tenant_id, run_id, snapshot_at, snapshot_date_key, published_at, testimonial_count)
      SELECT tenant_id, id, source_snapshot_at, (source_snapshot_at AT TIME ZONE 'UTC')::date, finished_at, source_testimonial_count
      FROM etl.runs WHERE tenant_id = ${tenant}::uuid`;
    await system.target.$executeRaw`INSERT INTO dw.fact_testimonial_snapshot
      (tenant_id, run_id, testimonial_id, category_key, status_code, rating, score, created_at, has_image, has_video, snapshot_at, snapshot_date_key)
      SELECT h.tenant_id, h.run_id, t.id::uuid, c.category_key, 'published', 5, 0, t.created::timestamptz, false, false, h.snapshot_at, h.snapshot_date_key
      FROM dw.fact_tenant_snapshot h JOIN dw.dim_category c ON c.tenant_id = h.tenant_id
      JOIN unnest(${sourceRows.map((row) => row.id)}::text[], ${sourceRows.map((row) => row.createdAt.toISOString())}::text[]) AS t(id, created)
        ON t.created::timestamptz <= h.snapshot_at WHERE h.tenant_id = ${tenant}::uuid`;
    // Build the synthetic observation registry directly, then validate it. This is fixture setup, not a backfill timing claim.
    await system.target.$executeRaw`INSERT INTO dw.fact_testimonial_creation
      (tenant_id, testimonial_id, created_at, first_observed_at, first_observed_date_key, first_observed_run_id)
      SELECT DISTINCT ON (testimonial_id) tenant_id, testimonial_id, created_at, snapshot_at, snapshot_date_key, run_id
      FROM dw.fact_testimonial_snapshot WHERE tenant_id = ${tenant}::uuid ORDER BY testimonial_id, snapshot_at, run_id`;
    await system.target
      .$executeRaw`INSERT INTO dw.statistics_history_state (tenant_id, creations_through_run_id)
      SELECT tenant_id, run_id FROM dw.fact_tenant_snapshot WHERE tenant_id = ${tenant}::uuid ORDER BY snapshot_at DESC, run_id LIMIT 1`;
    const history = await new StatisticsHistoryRepository(
      system.target,
    ).check();
    if (history.pendingTenants || history.missingCreations)
      throw new Error('BENCH_HISTORY');
    await new StatisticsService(
      new StatisticsJobRepository(system.target),
      new StatisticsInputRepository(system.target),
    ).tick(new AbortController().signal);
    const preparationMs = performance.now() - preparation;
    progress('api_baseline');
    await system.target.$executeRawUnsafe('ANALYZE');
    await system.source.$executeRawUnsafe('ANALYZE');
    system.configure({ BI_STATISTICS_ENABLED: String(statistics) });
    const app = await system.startApi();
    const base = await app.getUrl();
    const login = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Mode': 'bearer' },
      body: JSON.stringify({
        email: system.users[0]!.admin.email,
        password: system.password,
      }),
    });
    const session = (await login.json()) as {
      data: { tokens: { accessToken: string } };
    };
    if (!login.ok) throw new Error('BENCH_LOGIN');
    const headers = {
      Authorization: `Bearer ${session.data.tokens.accessToken}`,
      'Content-Type': 'application/json',
    };
    const paths = [
      'testimonials?limit=20',
      'bi/dashboard',
      ...(statistics ? ['bi/statistics'] : []),
    ];
    async function workload(rounds: number, routes: string[]) {
      const samples = new Map(routes.map((path) => [path, [] as number[]]));
      const statuses = new Map<number, number>();
      const started = performance.now();
      const cpu = process.cpuUsage();
      for (let i = 0; i < rounds; i++) {
        await Promise.all(
          routes.map(async (path) => {
            const at = performance.now();
            const response = await fetch(`${base}/api/v1/${path}`, { headers });
            await response.arrayBuffer();
            samples.get(path)!.push(performance.now() - at);
            statuses.set(
              response.status,
              (statuses.get(response.status) ?? 0) + 1,
            );
          }),
        );
        await delay(50);
      }
      const used = process.cpuUsage(cpu);
      return {
        durationMs: performance.now() - started,
        nodeCpuMs: (used.user + used.system) / 1000,
        rssBytes: process.memoryUsage().rss,
        statuses: Object.fromEntries(statuses),
        routes: Object.fromEntries(
          [...samples].map(([path, values]) => [path, quantiles(values)]),
        ),
      };
    }
    await workload(1, paths);
    const baseline = await workload(10, ['testimonials?limit=20']);
    await new WorkerControlRepository(system.target).heartbeat(randomUUID());
    const accepted = await fetch(`${base}/api/v1/bi/requests`, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': randomUUID() },
      body: '{"kind":"manual"}',
    });
    if (accepted.status !== 202) throw new Error('BENCH_ACCEPT');
    progress('worker_and_reads');
    const workerAt = performance.now();
    const phaseEvents: Array<Record<string, unknown>> = [];
    let buffered = '';
    child = spawn(
      process.execPath,
      [
        '-r',
        'ts-node/register/transpile-only',
        'src/modules/business-intelligence/etl.cli.ts',
        '--once',
      ],
      {
        env: {
          ...process.env,
          ...system.workerEnv,
          BI_STATISTICS_ENABLED: String(statistics),
        },
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    child.stdout!.on('data', (chunk: Buffer) => {
      buffered += chunk.toString();
      const lines = buffered.split('\n');
      buffered = lines.pop()!;
      for (const line of lines) {
        try {
          const parsed: unknown = JSON.parse(line);
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            'message' in parsed
          ) {
            const message: unknown = parsed.message;
            if (
              typeof message === 'object' &&
              message !== null &&
              'event' in message &&
              ['bi.etl_phase_finished', 'bi.statistics_task_finished'].includes(
                String(message.event),
              )
            ) {
              const { event, durationMs } = message as {
                event: string;
                durationMs: number;
              };
              phaseEvents.push({ event, durationMs });
            }
          }
        } catch {
          /* Do not copy raw worker output into evidence. */
        }
      }
    });
    const finished = once(child, 'exit').then(([code]) => ({
      code,
      durationMs: performance.now() - workerAt,
    }));
    let sourceConnected = false;
    for (let i = 0; i < 200 && child.exitCode === null; i++) {
      const [row] = await system.source.$queryRaw<
        Array<{ live: boolean }>
      >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE usename = ${system.roles.extractRole}) AS live`;
      if (row?.live) {
        sourceConnected = true;
        break;
      }
      await delay(50);
    }
    const concurrent = await workload(20, paths);
    const worker = await finished;
    const [run] = await system.target.$queryRaw<
      Array<{ durationMs: number; testimonials: string; at: Date }>
    >`SELECT
      (extract(epoch FROM (finished_at - started_at)) * 1000)::float8 AS "durationMs", source_testimonial_count::text AS testimonials, source_snapshot_at AS at
      FROM etl.runs WHERE tenant_id = ${tenant}::uuid ORDER BY source_snapshot_at DESC LIMIT 1`;
    const [job] = await system.target.$queryRaw<
      Array<{ durationMs: number; status: string; errorCode: string | null }>
    >`SELECT
      (extract(epoch FROM (finished_at - claimed_at)) * 1000)::float8 AS "durationMs", status, error_code AS "errorCode" FROM etl.statistics_jobs
      WHERE tenant_id = ${tenant}::uuid ORDER BY source_snapshot_at DESC LIMIT 1`;
    const [size] = await system.target.$queryRaw<
      Array<{
        bytes: string;
        snapshots: string;
        details: string;
        links: string;
        reports: string;
        creations: string;
      }>
    >`SELECT
      pg_database_size(current_database())::text AS bytes, (SELECT count(*)::text FROM dw.fact_tenant_snapshot) AS snapshots,
      (SELECT count(*)::text FROM dw.fact_testimonial_snapshot) AS details, (SELECT count(*)::text FROM dw.bridge_testimonial_tag_snapshot) AS links,
      (SELECT count(*)::text FROM dw.statistics_publication) AS reports, (SELECT count(*)::text FROM dw.fact_testimonial_creation) AS creations`;
    if (
      worker.code !== 0 ||
      !sourceConnected ||
      !run ||
      run.durationMs > 300000 ||
      (statistics &&
        (!job || job.status !== 'succeeded' || job.durationMs > 60000)) ||
      Object.keys(concurrent.statuses).some((code) => code !== '200') ||
      Object.keys(baseline.statuses).some((code) => code !== '200')
    )
      throw new BenchmarkFailure({
        statistics,
        worker,
        sourceConnected,
        runDurationMs: run?.durationMs ?? null,
        job,
        statuses: concurrent.statuses,
      });
    return {
      statistics,
      preparationMs,
      baseline,
      concurrent,
      sourceConnected,
      worker,
      phases: phaseEvents,
      etl: { durationMs: run.durationMs, testimonials: run.testimonials },
      statisticsJob: statistics ? job : null,
      size,
    };
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exit = once(child, 'exit');
      child.kill('SIGTERM');
      await exit;
    }
    await system.close();
  }
}
async function main() {
  if (process.argv[2] !== '--run') throw new Error('BENCH_OPT_IN');
  const report = {
    generatedAt: new Date().toISOString(),
    node: process.version,
    logicalCpus: cpus().length,
    hostMemoryBytes: totalmem(),
    dataset: {
      sourceTestimonials: 1002,
      observedTenantTestimonials: 1001,
      tags: 50,
      sourceRelations: 50050,
      dailyHistoryCuts: 425,
    },
    pools: { cms: 8, biRead: 2, biControl: 2, extract: 1, writer: 2 },
    modes: [await mode(false), await mode(true)],
    limitations: [
      'Same physical host; fresh fixture per mode, warm cache after preparation; fixed order off then on',
      '10 baseline and 20 concurrent batches per route; small p95/p99 sample, not user capacity or production SLO',
      'On mode also queries statistics, off mode only dashboard; comparison combines feature and read workload costs',
      'Source connection gate does not prove every HTTP sample overlaps a specific ETL or calculation phase',
      'Synthetic daily history; no historical tag reconstruction; no evidence of real predictive utility',
      'CPU/RSS describe parent API process only; no per-database CPU/IO isolation claim',
    ],
  };
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}
void main().catch((error: unknown) => {
  if (error instanceof BenchmarkFailure)
    process.stdout.write(
      JSON.stringify({ failed: true, evidence: error.evidence }, null, 2) +
        '\n',
    );
  process.stderr.write('BI_STATISTICS_BENCHMARK_FAILED\n');
  process.exitCode = 1;
});
