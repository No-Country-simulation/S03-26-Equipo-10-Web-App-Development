/** Opt-in local workload, real CMS/Redis and two disposable servers. Not a production capacity certificate. */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { cpus, totalmem } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { WorkerControlRepository } from '../src/modules/business-intelligence/repositories/worker-control.repository';
import { createBiSystem } from './fixtures/bi-system-environment';

async function main() {
  if (process.argv[2] !== '--run') throw new Error('BI_BENCH_OPT_IN_REQUIRED');
  const system = await createBiSystem();
  let worker: ReturnType<typeof spawn> | undefined;
  try {
    const tenant = system.users[0]!.company.id;
    await system.target.$executeRaw`INSERT INTO etl.load_requests
      (id, tenant_id, actor_id, kind, idempotency_key, payload_hash, slot_at, expires_at, status, created_at, finished_at)
      SELECT md5('request-' || t || '-' || h)::uuid,
        CASE WHEN t=1 THEN ${tenant}::uuid ELSE md5('tenant-' || t)::uuid END, md5('actor-' || t)::uuid,
        'manual', 'fixture-' || h, repeat('a',64), date_trunc('hour',now())-h*interval '1 hour',
        date_trunc('hour',now())-(h-1)*interval '1 hour', 'cancelled',
        date_trunc('hour',now())-h*interval '1 hour'+interval '1 minute', date_trunc('hour',now())-h*interval '1 hour'+interval '2 minutes'
      FROM generate_series(1,100) t CROSS JOIN generate_series(1,200) h`;
    await system.target.$executeRaw`INSERT INTO etl.runs (id, tenant_id, slot_at, attempt_no, status, started_at, finished_at, error_code)
      SELECT md5('run-' || t || '-' || h)::uuid,
        CASE WHEN t=1 THEN ${tenant}::uuid ELSE md5('tenant-' || t)::uuid END,
        date_trunc('hour',now())-h*interval '1 hour', 1, 'failed',
        date_trunc('hour',now())-h*interval '1 hour'+interval '1 minute', date_trunc('hour',now())-h*interval '1 hour'+interval '2 minutes', 'BI_ETL_FAILED'
      FROM generate_series(1,100) t CROSS JOIN generate_series(1,200) h`;
    await system.target.$executeRaw`INSERT INTO etl.control_audit (tenant_id,actor_id,action,request_id,created_at)
      SELECT tenant_id,actor_id,'request_created',id,created_at FROM etl.load_requests`;
    await system.source.$executeRaw`INSERT INTO testimonials
      (id,tenant_id,content,author_name,rating,status_id,created_at,updated_at,published_at)
      SELECT gen_random_uuid(),${tenant}::uuid,'Synthetic workload content','Synthetic author',1+g%5,4,now(),now(),now()
      FROM generate_series(1,4000) g`;
    await system.source.$executeRaw`INSERT INTO analytics_events (tenant_id,testimonial_id,event_type_id,source,created_at)
      SELECT ${tenant}::uuid,t.id,1+g%3,'widget',now() FROM testimonials t CROSS JOIN generate_series(1,5) g WHERE t.tenant_id=${tenant}::uuid`;
    await system.target.$executeRawUnsafe('ANALYZE'); await system.source.$executeRawUnsafe('ANALYZE');
    const app = await system.startApi(); const base = await app.getUrl();
    const login = await fetch(`${base}/api/v1/auth/login`, { method:'POST', headers: { 'Content-Type':'application/json','X-Auth-Mode':'bearer' },
      body: JSON.stringify({email:system.users[0]!.admin.email,password:system.password}) });
    const session = await login.json() as { data: { tokens: { accessToken:string } } };
    if (!login.ok) throw new Error('BI_BENCH_LOGIN');
    const headers = { Authorization:`Bearer ${session.data.tokens.accessToken}`,'Content-Type':'application/json' };
    const today = new Date().toISOString().slice(0,10); const from = new Date(Date.now()-29*86400000).toISOString().slice(0,10);
    const range=`from=${from}&to=${today}&page=1&limit=20`;
    function stats(samples:number[]) { const sorted=[...samples].sort((a,b)=>a-b); return { requests:sorted.length,
      p50Ms:sorted.at(Math.ceil(sorted.length*.5)-1)??null,p95Ms:sorted.at(Math.ceil(sorted.length*.95)-1)??null,
      p99Ms:sorted.at(Math.ceil(sorted.length*.99)-1)??null }; }
    async function workload(paths:string[], rounds:number) {
      const samples=new Map(paths.map(path=>[path,[] as number[]])); const statuses:Record<string,number>={};
      const started=performance.now(); const cpu=process.cpuUsage();
      for (let i=0;i<rounds;i++) {
        await Promise.all(paths.map(async path=>{const at=performance.now();const response=await fetch(`${base}/api/v1/${path}`,{headers});
          await response.arrayBuffer(); samples.get(path)!.push(performance.now()-at); statuses[String(response.status)]=(statuses[String(response.status)]??0)+1; }));
        await delay(200);
      }
      const used=process.cpuUsage(cpu); return { durationMs:performance.now()-started,nodeCpuMs:(used.user+used.system)/1000,
        rssBytes:process.memoryUsage().rss,statuses,routes:Object.fromEntries([...samples].map(([path,values])=>[path,stats(values)])) };
    }
    await fetch(`${base}/api/v1/bi/status`,{headers}); await fetch(`${base}/api/v1/testimonials?limit=20`,{headers});
    const baseline=await workload(['testimonials?limit=20'],30);
    await new WorkerControlRepository(system.target).heartbeat(randomUUID());
    const accepted=await fetch(`${base}/api/v1/bi/requests`,{method:'POST',headers:{...headers,'Idempotency-Key':randomUUID()},body:'{"kind":"manual"}'});
    if (accepted.status!==202) throw new Error('BI_BENCH_REQUEST');
    const workerAt=performance.now();
    worker=spawn(process.execPath,['-r','ts-node/register/transpile-only','src/modules/business-intelligence/etl.cli.ts','--once'],
      {env:{...process.env,...system.workerEnv},stdio:'ignore'});
    const finished=once(worker,'exit').then(([code])=>({code,durationMs:performance.now()-workerAt}));
    const withPolling=await workload(['testimonials?limit=20','bi/status',`bi/runs?${range}&status=failed&origin=legacy`,
      `bi/requests?${range}&status=cancelled`,`bi/audit?${range}`],40);
    const etl=await finished;
    const queries = {
      currentBudget:Prisma.sql`SELECT coalesce(max(attempt_no),0),coalesce(bool_or(status='succeeded'),false)
        FROM etl.runs WHERE tenant_id=${tenant}::uuid AND slot_at=date_trunc('hour',now())`,
      latestFailure:Prisma.sql`SELECT id,status FROM etl.runs WHERE tenant_id=${tenant}::uuid AND status IN ('failed','abandoned') ORDER BY started_at DESC,id DESC LIMIT 1`,
      filteredRuns:Prisma.sql`SELECT id,status FROM etl.runs WHERE tenant_id=${tenant}::uuid AND started_at>=${from}::date
        AND started_at<${today}::date+interval '1 day' AND status='failed' AND origin='legacy' ORDER BY started_at DESC,id DESC LIMIT 20`,
      filteredRequests:Prisma.sql`SELECT id,status FROM etl.load_requests WHERE tenant_id=${tenant}::uuid AND created_at>=${from}::date
        AND created_at<${today}::date+interval '1 day' AND status='cancelled' ORDER BY created_at DESC,id DESC LIMIT 20`,
      requestCount:Prisma.sql`SELECT count(*) FROM etl.load_requests WHERE tenant_id=${tenant}::uuid AND created_at>=${from}::date
        AND created_at<${today}::date+interval '1 day' AND status='cancelled'`,
      audit:Prisma.sql`SELECT id,action FROM etl.control_audit WHERE tenant_id=${tenant}::uuid AND created_at>=${from}::date
        AND created_at<${today}::date+interval '1 day' ORDER BY created_at DESC,id DESC LIMIT 20`,
    };
    const plans=new Map<string,unknown>();
    for (const [name,sql] of Object.entries(queries)) {
      const [plan]=await system.target.$queryRaw<Array<{'QUERY PLAN':unknown}>>(Prisma.sql`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) ${sql}`); plans.set(name,plan?.['QUERY PLAN']);
    }
    const [settings]=await system.target.$queryRaw`SELECT current_setting('server_version') AS version,current_setting('shared_buffers') AS buffers,
      current_setting('max_connections') AS connections,current_setting('timezone') AS timezone` as Array<Record<string,string>>;
    const [run]=await system.target.$queryRaw`SELECT status,source_testimonial_count::text AS testimonials,source_event_count::text AS events,
      extract(epoch FROM finished_at-started_at)*1000 AS duration_ms FROM etl.runs WHERE tenant_id=${tenant}::uuid AND status='succeeded'` as Array<Record<string,unknown>>;
    const report={generatedAt:new Date().toISOString(),node:process.version,logicalCpus:cpus().length,hostMemoryBytes:totalmem(),settings,
      dataset:{historyTenants:100,hoursPerTenant:200,requests:20000,runs:20000,audit:20002,sourceTestimonials:4002,sourceEvents:20013},
      pools:{cms:8,biRead:2,biControl:2,extract:1,writer:2},baseline,withPolling,etl:{...etl,run},plans:Object.fromEntries(plans),
      limitations:['Same physical host and warm cache','40 accelerated batches of five concurrent routes; not a sustained user capacity test',
        'Real disposable Redis and production guards; no quota bypass','CMS DDL generated from Prisma plus export views, not complete historical migration replay',
        'HTTP latency includes pool waiting, Node and database; EXPLAIN only measures individual SQL','No agreed production SLO; certify again on target resources']};
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
    if (etl.code!==0 || Object.keys(withPolling.statuses).some(code=>code!=='200')) process.exitCode=1;
  } finally {
    if (worker && worker.exitCode === null && worker.signalCode === null) {
      const stopped=once(worker,'exit');worker.kill('SIGTERM');await stopped;
    }
    await system.close();
  }
}
void main().catch(()=>{process.stderr.write('BI_OPERATIONS_BENCH_FAILED\n');process.exitCode=1;});
