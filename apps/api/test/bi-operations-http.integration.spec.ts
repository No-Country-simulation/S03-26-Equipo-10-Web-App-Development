import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Global, Module, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { CredentialRepository } from '../src/common/repositories/credential.repository';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';
import { CsrfGuard } from '../src/common/guards/csrf.guard';
import { RateLimitService } from '../src/common/services/rate-limit.service';
import { SessionCsrfService } from '../src/common/services/session-csrf.service';
import { RateLimitedError } from '../src/common/errors/application.error';
import { BiMetricsService } from '../src/modules/business-intelligence/services/bi-metrics.service';
import { BusinessIntelligenceModule } from '../src/modules/business-intelligence/business-intelligence.module';
import { applyWarehouseMigration } from '../src/modules/business-intelligence/repositories/warehouse-migrations';
import { ManagedWarehouseRepository } from '../src/modules/business-intelligence/repositories/managed-warehouse.repository';
import { WarehouseRepository } from '../src/modules/business-intelligence/repositories/warehouse.repository';
import { hourUtc } from '../src/modules/business-intelligence/etl.types';
import { installBiWarehouse } from './fixtures/bi-warehouse';
import { restoreEnvironment } from './fixtures/bi-control-environment';

const adminUrl = process.env.TEST_BI_WAREHOUSE_DATABASE_URL;
const tenant = randomUUID(); const otherTenant = randomUUID(); const adminId = randomUUID(); const editorId = randomUUID(); const otherId = randomUUID();
const secret = 'synthetic-bi-http-test-signing-key';
const quota = { assertWithinLimit: jest.fn() };
const credentials = { findActiveUser: async (id: string) => [adminId, editorId, otherId].some(known => known === id)
  ? { userId: id, tenantId: id === otherId ? otherTenant : tenant, roles: [id === editorId ? 'editor' : 'admin'] } : null };
@Global()
@Module({ providers: [JwtService, SessionCsrfService,
  { provide: ConfigService, useValue: { getOrThrow: () => ({ jwt: { secret }, corsOrigin: 'http://localhost:3000' }) } },
  { provide: CredentialRepository, useValue: credentials }, { provide: RateLimitService, useValue: quota }],
exports: [JwtService, ConfigService, CredentialRepository, RateLimitService, SessionCsrfService] })
class HttpFixtureCommonModule {}

const databaseTests = adminUrl ? describe : describe.skip;
databaseTests('BI operational HTTP on disposable PostgreSQL with restricted identities', () => {
  jest.setTimeout(30000);
  const suffix = randomUUID().replaceAll('-', ''); const database = `bi_http_${suffix}`;
  const controlRole = `bi_ctl_${suffix}`; const readRole = `bi_read_${suffix}`;
  let parent: PrismaClient; let db: PrismaClient; let app: INestApplication;
  let adminToken: string; let editorToken: string; let otherToken: string;
  function url(user?: string) {
    const parsed = new URL(adminUrl!); parsed.pathname = `/${database}`; parsed.searchParams.set('connection_limit', '2');
    if (user) { parsed.username = user; parsed.password = ''; } return parsed.toString();
  }
  beforeAll(async () => {
    parent = new PrismaClient({ datasources: { db: { url: adminUrl! } } });
    await parent.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
    await parent.$executeRawUnsafe(`CREATE ROLE "${controlRole}" LOGIN`); await parent.$executeRawUnsafe(`CREATE ROLE "${readRole}" LOGIN`);
    db = new PrismaClient({ datasources: { db: { url: url() } } }); await installBiWarehouse(db);
    // Fixed repository migration, never caller input.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const sql = await readFile(join(__dirname, '../warehouse/migrations/0004_bi_operations.sql'), 'utf8');
    await applyWarehouseMigration(db, '0004_bi_operations.sql', sql);
    await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA etl TO "${controlRole}", "${readRole}"`);
    await db.$executeRawUnsafe(`GRANT USAGE ON SCHEMA dw TO "${readRole}"`);
    await db.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA dw TO "${readRole}"`);
    await db.$executeRawUnsafe(`GRANT SELECT ON etl.tenant_settings, etl.load_requests, etl.control_audit, etl.runs, etl.tenant_load_state, etl.worker_health TO "${controlRole}", "${readRole}"`);
    await db.$executeRawUnsafe(`GRANT INSERT ON etl.tenant_settings, etl.load_requests, etl.control_audit TO "${controlRole}"`);
    await db.$executeRawUnsafe(`GRANT UPDATE ON etl.tenant_settings TO "${controlRole}"`);
    await db.$executeRawUnsafe(`GRANT UPDATE (status, finished_at, error_code) ON etl.load_requests TO "${controlRole}"`);
    const previous = { BI_ENABLED: process.env.BI_ENABLED, BI_OPERATIONS_ENABLED: process.env.BI_OPERATIONS_ENABLED, BI_CONTROL_DATABASE_URL: process.env.BI_CONTROL_DATABASE_URL };
    const previousRead = process.env.BI_DATABASE_URL;
    try {
      process.env.BI_ENABLED = 'true'; process.env.BI_OPERATIONS_ENABLED = 'true';
      process.env.BI_DATABASE_URL = url(readRole); process.env.BI_CONTROL_DATABASE_URL = url(controlRole);
      const module = await Test.createTestingModule({ imports: [HttpFixtureCommonModule, BusinessIntelligenceModule],
        providers: [{ provide: APP_GUARD, useClass: CsrfGuard }] }).compile();
      app = module.createNestApplication(); app.use(cookieParser()); app.setGlobalPrefix('api/v1');
      app.useGlobalPipes(new ZodValidationPipe()); app.useGlobalFilters(new ApiExceptionFilter()); app.useGlobalInterceptors(new ApiResponseInterceptor());
      await app.init();
      const jwt = app.get(JwtService);
      adminToken = jwt.sign({ sub: adminId, tenantId: tenant }, { secret });
      editorToken = jwt.sign({ sub: editorId, tenantId: tenant }, { secret });
      otherToken = jwt.sign({ sub: otherId, tenantId: otherTenant }, { secret });
    } finally {
      restoreEnvironment(previous);
      if (previousRead === undefined) delete process.env.BI_DATABASE_URL; else process.env.BI_DATABASE_URL = previousRead;
    }
  });
  beforeEach(async () => {
    quota.assertWithinLimit.mockReset().mockResolvedValue(undefined);
    await db.$executeRawUnsafe('TRUNCATE etl.load_requests, etl.runs, etl.tenant_settings, etl.control_audit, etl.tenant_load_state, etl.worker_health, dw.dim_tenant CASCADE');
    await db.$executeRaw`INSERT INTO etl.worker_health (worker_id, protocol_version) VALUES (${randomUUID()}::uuid, 1)`;
  });
  afterAll(async () => {
    await app?.close(); await db?.$disconnect();
    if (parent) {
      await parent.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
      await parent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${controlRole}"`); await parent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${readRole}"`);
      await parent.$disconnect();
    }
  });
  function get(path: string, token = adminToken) { return request(app.getHttpServer()).get(`/api/v1/bi/${path}`).auth(token, { type: 'bearer' }); }
  function create(key: string = randomUUID(), token = adminToken, body: object = { kind: 'manual' }) {
    return request(app.getHttpServer()).post('/api/v1/bi/requests').auth(token, { type: 'bearer' }).set('Idempotency-Key', key).send(body);
  }
  function patch(body: object, token = adminToken) { return request(app.getHttpServer()).patch('/api/v1/bi/settings').auth(token, { type: 'bearer' }).send(body); }
  function cancel(id: string, key: string = randomUUID(), token = adminToken) {
    return request(app.getHttpServer()).post(`/api/v1/bi/requests/${id}/cancel`).auth(token, { type: 'bearer' }).set('Idempotency-Key', key).send({});
  }
  async function failedRun(tenantId = tenant, attempt = 1) {
    const id = randomUUID(); await db.$executeRaw`INSERT INTO etl.runs
      (id, tenant_id, slot_at, attempt_no, status, started_at, finished_at, error_code, origin, phase)
      VALUES (${id}::uuid, ${tenantId}::uuid, ${hourUtc(new Date())}, ${attempt}, 'failed',
        clock_timestamp() - interval '1 second', clock_timestamp(), 'BI_ETL_FAILED', 'scheduled', 'extraction')`;
    return id;
  }

  it('requires valid authentication on every operational endpoint', async () => {
    for (const path of ['status', 'settings', 'runs', 'requests', 'audit', `runs/${randomUUID()}`, `requests/${randomUUID()}`]) {
      await request(app.getHttpServer()).get(`/api/v1/bi/${path}`).expect(401);
    }
    await get('status', app.get(JwtService).sign({ sub: randomUUID(), tenantId: tenant }, { secret })).expect(401);
    await request(app.getHttpServer()).post('/api/v1/bi/requests').send({ kind: 'manual' }).expect(401);
  });
  it('lets editors read but blocks all mutations and audit before persisting', async () => {
    for (const path of ['status', 'settings', 'runs', 'requests']) {
      const response = await get(path, editorToken).expect(200); expect(response.headers['cache-control']).toBe('private, no-store');
    }
    const status = await get('status', editorToken); expect(status.body.data.actions.runNow.reason).toBe('BI_ADMIN_REQUIRED');
    await patch({ expectedVersion: 0, frequencyHours: 6 }, editorToken).expect(403);
    await create('editor', editorToken).expect(403); await cancel(randomUUID(), 'editor', editorToken).expect(403);
    await get('audit', editorToken).expect(403); expect((await get('audit')).body.meta.total).toBe(0);
  });
  it('derives ownership and actor from the session, versions changes and preserves the winner', async () => {
    const initial = await get('settings').expect(200); expect(initial.body.data.version).toBe(0);
    const results = await Promise.all([patch({ expectedVersion: 0, frequencyHours: 6 }), patch({ expectedVersion: 0, frequencyHours: 24 })]);
    expect(results.map(value => value.status).sort()).toEqual([200, 409]);
    expect(results.find(value => value.status === 409)?.body.code).toBe('BI_SETTINGS_CONFLICT');
    expect((await get('settings')).body.data.version).toBe(1); expect((await get('settings', otherToken)).body.data.version).toBe(0);
    const audit = await get('audit').expect(200); expect(audit.body.meta.total).toBe(1); expect(audit.body.data[0].actorId).toBe(adminId);
    expect(JSON.stringify(audit.body)).not.toContain('password');
  });
  it.each([
    ['settings', { expectedVersion: 0, frequencyHours: 2 }], ['settings', { frequencyHours: 6 }],
    ['settings', { expectedVersion: 0 }], ['settings', { expectedVersion: 0, scheduleEnabled: false, tenantId: otherTenant }],
    ['requests', { kind: 'retry' }], ['requests', { kind: 'manual', retryOfRunId: randomUUID() }],
    ['requests', { kind: 'manual', tenantId: otherTenant }], ['requests', { kind: 'manual', actorId: otherId }],
    ['requests', { kind: 'manual', slotAt: '2020-01-01Z' }],
  ])('rejects strict body validation on %s with %j', async (path, body) => {
    await (path === 'settings' ? patch(body) : create('invalid', adminToken, body)).expect(400);
    expect((await get('audit')).body.meta.total).toBe(0);
  });
  it.each(['status?tenantId=foreign', 'settings?extra=1', 'runs?limit=101', 'runs?page=10001', 'runs?origin=unknown',
    'runs?from=2023-02-29', 'runs?from=2000-01-01', 'runs?to=9999-01-01', 'requests?status=unknown', 'audit?limit=0', 'runs/not-a-uuid'])
  ('rejects invalid query or ID: %s', async path => { await get(path).expect(400); });
  it('requires a valid durable idempotency key on creation and cancellation', async () => {
    await request(app.getHttpServer()).post('/api/v1/bi/requests').auth(adminToken, { type: 'bearer' }).send({ kind: 'manual' }).expect(400);
    await create('invalid key').expect(400); await create('x'.repeat(129)).expect(400);
    await request(app.getHttpServer()).post(`/api/v1/bi/requests/${randomUUID()}/cancel`).auth(adminToken, { type: 'bearer' }).send({}).expect(400);
  });
  it('accepts durable pending work, replays double clicks and never executes ETL in HTTP', async () => {
    const [a, b] = await Promise.all([create('same'), create('same')]);
    expect(a.status).toBe(202); expect(b.status).toBe(202); expect(a.body.data).toEqual(b.body.data);
    expect(a.body.data.status).toBe('accepted');
    const detail = await get(`requests/${a.body.data.id}`).expect(200);
    expect(detail.body.data.request.status).toBe('pending'); expect(detail.body.data.runs).toEqual([]);
    expect((await get('runs')).body.meta.total).toBe(0); expect((await get('audit')).body.meta.total).toBe(1);
    await create('competing').expect(409);
    const status = await get('status'); expect(status.body.data.actions.runNow.reason).toBe('BI_REQUEST_CONFLICT');
    expect(status.body.data.actions.cancel.allowed).toBe(true);
  });
  it('isolates details, cancellations, retries, pagination and administrative history between tenants', async () => {
    const foreign = await create('foreign', otherToken).expect(202); const run = await failedRun(otherTenant);
    for (const path of [`requests/${foreign.body.data.id}`, `runs/${run}`]) { await get(path).expect(404); }
    await cancel(foreign.body.data.id).expect(404); await create('retry-foreign', adminToken, { kind: 'retry', retryOfRunId: run }).expect(404);
    expect((await get('requests')).body.data).toEqual([]); expect((await get('runs')).body.data).toEqual([]);
    expect((await get('audit')).body.data).toEqual([]); expect((await get('status')).body.data.activeRequest).toBeNull();
    expect((await get('requests', otherToken)).body.meta.total).toBe(1);
  });
  it('preserves key binding and replays receipts even after cancellation and a stopped worker', async () => {
    const run = await failedRun(); const first = await create('receipt').expect(202);
    const id = first.body.data.id; await cancel(id, 'cancel').expect(200); await cancel(id, 'cancel').expect(200);
    await db.$executeRaw`UPDATE etl.worker_health SET stopping = true`;
    expect((await create('receipt').expect(202)).body.data).toEqual(first.body.data);
    const conflict = await create('receipt', adminToken, { kind: 'retry', retryOfRunId: run }).expect(409);
    expect(conflict.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect((await get('audit')).body.meta.total).toBe(2);
    await create('offline').expect(503); expect((await get('requests')).body.meta.total).toBe(1);
  });
  it('rejects new work without a live worker, safely reports the issue and leaves no partial audit', async () => {
    await db.$executeRaw`DELETE FROM etl.worker_health`;
    const status = await get('status').expect(200); expect(status.body.data.service.status).toBe('unavailable');
    expect(status.body.data.actions.runNow.reason).toBe('BI_WORKER_UNAVAILABLE');
    expect(status.body.data.alerts[0].code).toBe('BI_WORKER_UNAVAILABLE');
    const rejected = await create('offline').expect(503); expect(rejected.body.code).toBe('BI_WORKER_UNAVAILABLE');
    expect((await get('audit')).body.meta.total).toBe(0); expect((await get('requests')).body.meta.total).toBe(0);
    await patch({ expectedVersion: 0, frequencyHours: 24 }).expect(200);
  });
  it('paginates, filters runs and preserves unknown counts instead of inventing zero', async () => {
    const first = await failedRun(); await failedRun(tenant, 2); await failedRun(otherTenant);
    const page = await get('runs?origin=scheduled&status=failed&limit=1&page=2').expect(200);
    expect(page.body.meta).toEqual({ total: 2, page: 2, limit: 1 }); expect(page.body.data).toHaveLength(1);
    const detail = await get(`runs/${first}`, editorToken).expect(200);
    expect(detail.body.data.sourceCounts).toBeNull(); expect(detail.body.data.destinationCounts).toBeNull();
    expect(detail.body.data.errorMessage).toContain('último corte'); expect(detail.body.data.actions.retry.allowed).toBe(false);
    expect((await get(`runs/${first}`)).body.data.actions.retry.allowed).toBe(true);
    const retry = await create('retry', adminToken, { kind: 'retry', retryOfRunId: first }).expect(202);
    expect((await get(`requests/${retry.body.data.id}`)).body.data.request.retryOfRunId).toBe(first);
  });
  it('allows manual requests while paused and keeps the shared hourly attempt budget', async () => {
    await patch({ expectedVersion: 0, scheduleEnabled: false }).expect(200);
    const status = await get('status'); expect(status.body.data.schedule.paused).toBe(true); expect(status.body.data.actions.runNow.allowed).toBe(true);
    const first = await create('paused').expect(202); await cancel(first.body.data.id).expect(200);
    for (const attempt of [1, 2, 3]) await failedRun(tenant, attempt);
    await patch({ expectedVersion: 1, frequencyHours: 24 }).expect(200);
    const blocked = await create('exhausted').expect(409); expect(blocked.body.code).toBe('BI_ATTEMPTS_EXHAUSTED');
    expect((await get('status')).body.data.budget.attemptsRemaining).toBe(0);
  });
  it('publishes empty correct data and applies configured freshness independently of DashboardRepository', async () => {
    const warehouse = new WarehouseRepository(db); const lease = await warehouse.claim(tenant, hourUtc(new Date()));
    if (!lease) throw new Error('Expected lease');
    const snapshot = { tenantId: tenant, name: 'Synthetic empty', isActive: true, at: new Date() };
    await warehouse.snapshot(lease, snapshot); await warehouse.publish(lease, snapshot, { categories: 0n, testimonials: 0n, events: 0n });
    await patch({ expectedVersion: 0, frequencyHours: 24, delayToleranceMinutes: 120 }).expect(200);
    const dashboard = await get('dashboard', editorToken).expect(200);
    expect(dashboard.body.data.summary.totalTestimonials).toBe(0); expect(dashboard.body.data.summary.ctr).toBeNull();
    expect(dashboard.body.data.freshness.staleAfterSeconds).toBe(93600); expect(dashboard.body.data.freshness.status).toBe('fresh');
    const status = await get('status'); expect(status.body.data.actions.runNow.reason).toBe('BI_ALREADY_SUCCEEDED');
    await create('already-done').expect(409);
  });
  it('adapts technical stale metrics to frequency and pause without exposing the global metrics token', async () => {
    const id = randomUUID(); const observed = new Date(Date.now() - 3 * 3600000);
    await db.$executeRaw`INSERT INTO etl.runs (id, tenant_id, slot_at, attempt_no, status, source_snapshot_at, started_at, finished_at)
      VALUES (${id}::uuid, ${tenant}::uuid, ${hourUtc(observed)}, 1, 'succeeded', ${observed}, ${observed}, ${observed})`;
    await db.$executeRaw`INSERT INTO etl.tenant_load_state (tenant_id, last_published_run_id) VALUES (${tenant}::uuid, ${id}::uuid)`;
    const metrics = app.get(BiMetricsService);
    expect(await metrics.render()).toContain('tms_bi_tenants_stale 1');
    await patch({ expectedVersion: 0, frequencyHours: 24 }).expect(200);
    expect(await metrics.render()).toContain('tms_bi_tenants_stale 0');
    await patch({ expectedVersion: 1, frequencyHours: 1, scheduleEnabled: false }).expect(200);
    expect(await metrics.render()).toContain('tms_bi_tenants_stale 0');
    expect(JSON.stringify((await get('status')).body)).not.toMatch(/metricsToken|x-metrics-token|worker_id/);
  });
  it('enforces cookie CSRF with the current session mechanism and accepts explicit Bearer clients', async () => {
    const cookies = [`accessToken=${adminToken}`, 'refreshToken=synthetic-refresh'];
    await request(app.getHttpServer()).patch('/api/v1/bi/settings').set('Cookie', cookies).set('Origin', 'http://localhost:3000')
      .send({ expectedVersion: 0, frequencyHours: 6 }).expect(403);
    const csrf = app.get(SessionCsrfService).tokenFor('synthetic-refresh');
    await request(app.getHttpServer()).patch('/api/v1/bi/settings').set('Cookie', cookies).set('Origin', 'http://foreign.invalid')
      .set('x-csrf-token', csrf).send({ expectedVersion: 0, frequencyHours: 6 }).expect(403);
    await request(app.getHttpServer()).patch('/api/v1/bi/settings').set('Cookie', cookies).set('Origin', 'http://localhost:3000')
      .set('x-csrf-token', csrf).send({ expectedVersion: 0, frequencyHours: 6 }).expect(200);
    await patch({ expectedVersion: 1, frequencyHours: 24 }).expect(200);
  });
  it('applies tenant quotas, reports 429 and fails closed on mutations if quotas are unavailable', async () => {
    quota.assertWithinLimit.mockRejectedValueOnce(new RateLimitedError('Quota exceeded'));
    await create('limited').expect(429); expect((await get('audit')).body.meta.total).toBe(0);
    expect(quota.assertWithinLimit.mock.calls[0]?.[0]).toHaveLength(2);
    quota.assertWithinLimit.mockRejectedValueOnce(new Error('synthetic Redis outage'));
    await create('quota-down').expect(503); expect((await get('requests')).body.meta.total).toBe(0);
  });
  it('returns the worker result durably after an accepted HTTP client disconnects', async () => {
    const accepted = await create('worker-result').expect(202); const id = accepted.body.data.id;
    const warehouse = new ManagedWarehouseRepository(db); const lease = await warehouse.claim(tenant, hourUtc(new Date()));
    if (!lease) throw new Error('Expected managed lease');
    const snapshot = { tenantId: tenant, name: 'Synthetic empty', isActive: true, at: new Date() };
    const counts = { categories: 0n, testimonials: 0n, events: 0n };
    await warehouse.snapshot(lease, snapshot); await warehouse.extracted(lease, counts); await warehouse.publish(lease, snapshot, counts);
    const result = await get(`requests/${id}`, editorToken).expect(200);
    expect(result.body.data.request.status).toBe('succeeded');
    expect(result.body.data.runs).toMatchObject([{ origin: 'manual', status: 'succeeded', sourceCounts: { testimonials: '0' } }]);
    expect((await create('worker-result').expect(202)).body.data).toEqual(accepted.body.data);
    expect((await get('status')).body.data.activeRequest).toBeNull();
  });
  it('canonicalizes retry UUIDs and cancellation IDs for durable replays', async () => {
    const run = await failedRun();
    const first = await create('canonical', adminToken, { kind: 'retry', retryOfRunId: run }).expect(202);
    const second = await create('canonical', adminToken, { kind: 'retry', retryOfRunId: run.toUpperCase() }).expect(202);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect((await get(`requests/${first.body.data.id.toUpperCase()}`)).body.data.actions.cancel.allowed).toBe(true);
    await cancel(first.body.data.id, 'canonical-cancel').expect(200);
    await cancel(first.body.data.id.toUpperCase(), 'canonical-cancel').expect(200);
  });
  it('validates cancellation input and cannot cancel running or terminal work', async () => {
    const first = await create('cancel-validation').expect(202); const id = first.body.data.id;
    await request(app.getHttpServer()).post(`/api/v1/bi/requests/${id}/cancel`).auth(adminToken, { type: 'bearer' })
      .set('Idempotency-Key', 'invalid-body').send({ tenantId: otherTenant }).expect(400);
    await db.$executeRaw`UPDATE etl.load_requests SET status = 'running', started_at = clock_timestamp() WHERE tenant_id = ${tenant}::uuid AND id = ${id}::uuid`;
    const response = await cancel(id).expect(409); expect(response.body.code).toBe('BI_REQUEST_NOT_PENDING');
    expect((await get('audit')).body.meta.total).toBe(1);
  });
  it('handles lost reader/control connections without false receipts and recovers durable configuration', async () => {
    await patch({ expectedVersion: 0, frequencyHours: 6 }).expect(200); await get('status').expect(200);
    await db.$executeRawUnsafe(`ALTER ROLE "${controlRole}" NOLOGIN`); await db.$executeRawUnsafe(`ALTER ROLE "${readRole}" NOLOGIN`);
    try {
      await db.$queryRaw`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE datname = current_database() AND usename IN (${controlRole}, ${readRole}) AND pid <> pg_backend_pid()`;
      const read = await get('status').expect(503); expect(read.body.code).toBe('BI_UNAVAILABLE');
      const write = await create('disconnected').expect(503); expect(write.body.code).toBe('BI_UNAVAILABLE');
      await get('dashboard').expect(503);
      expect(JSON.stringify([read.body, write.body])).not.toMatch(/postgresql:|Prisma|stack|authentication failed/);
    } finally {
      await db.$executeRawUnsafe(`ALTER ROLE "${controlRole}" LOGIN`); await db.$executeRawUnsafe(`ALTER ROLE "${readRole}" LOGIN`);
    }
    expect((await get('settings').expect(200)).body.data).toMatchObject({ version: 1, frequencyHours: 6 });
    expect((await get('requests')).body.meta.total).toBe(0); expect((await get('audit')).body.meta.total).toBe(1);
  });
  it('returns safe unavailability rather than acceptance if the warehouse cannot persist control', async () => {
    await db.$executeRawUnsafe(`REVOKE INSERT ON etl.control_audit FROM "${controlRole}"`);
    try {
      const result = await create('failed-audit').expect(503); expect(result.body.code).toBe('BI_UNAVAILABLE');
      expect(JSON.stringify(result.body)).not.toMatch(/INSERT|Prisma|postgresql:|stack|permission denied/);
      expect((await get('requests')).body.meta.total).toBe(0);
    } finally { await db.$executeRawUnsafe(`GRANT INSERT ON etl.control_audit TO "${controlRole}"`); }
    await db.$executeRawUnsafe(`REVOKE SELECT ON etl.runs FROM "${readRole}"`);
    try {
      const result = await get('status').expect(503); expect(result.body.code).toBe('BI_UNAVAILABLE');
      expect(JSON.stringify(result.body)).not.toMatch(/SELECT|Prisma|postgresql:|stack|permission denied/);
    } finally { await db.$executeRawUnsafe(`GRANT SELECT ON etl.runs TO "${readRole}"`); }
  });
});

describe('BI operations feature gate without a warehouse', () => {
  it.each([false, true])('keeps new controls unavailable when BI enabled=%s and operations default to off', async enabled => {
    const previous = { BI_ENABLED: process.env.BI_ENABLED, BI_OPERATIONS_ENABLED: process.env.BI_OPERATIONS_ENABLED,
      BI_CONTROL_DATABASE_URL: process.env.BI_CONTROL_DATABASE_URL };
    const previousRead = process.env.BI_DATABASE_URL;
    let disabledApp: INestApplication | undefined;
    try {
      process.env.BI_ENABLED = String(enabled); delete process.env.BI_OPERATIONS_ENABLED;
      process.env.BI_DATABASE_URL = 'invalid'; process.env.BI_CONTROL_DATABASE_URL = 'invalid';
      const module = await Test.createTestingModule({ imports: [HttpFixtureCommonModule, BusinessIntelligenceModule] }).compile();
      disabledApp = module.createNestApplication(); disabledApp.setGlobalPrefix('api/v1');
      disabledApp.useGlobalPipes(new ZodValidationPipe()); disabledApp.useGlobalFilters(new ApiExceptionFilter());
      await disabledApp.init();
      const token = disabledApp.get(JwtService).sign({ sub: adminId, tenantId: tenant }, { secret });
      const response = await request(disabledApp.getHttpServer()).get('/api/v1/bi/status').auth(token, { type: 'bearer' }).expect(503);
      expect(response.body.code).toBe('BI_OPERATIONS_DISABLED'); expect(response.headers['cache-control']).toBe('private, no-store');
      await request(disabledApp.getHttpServer()).post('/api/v1/bi/requests').auth(token, { type: 'bearer' })
        .set('Idempotency-Key', 'disabled').send({ kind: 'manual' }).expect(503);
      const unauthenticated = await request(disabledApp.getHttpServer()).get('/api/v1/bi/settings').expect(401);
      expect(unauthenticated.headers['cache-control']).toBe('private, no-store');
    } finally {
      await disabledApp?.close(); restoreEnvironment(previous);
      if (previousRead === undefined) delete process.env.BI_DATABASE_URL; else process.env.BI_DATABASE_URL = previousRead;
    }
  });
});
