import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { hourUtc } from '../src/modules/business-intelligence/etl.types';
import { WarehouseRepository } from '../src/modules/business-intelligence/repositories/warehouse.repository';
import { WorkerControlRepository } from '../src/modules/business-intelligence/repositories/worker-control.repository';
import { OperationsControlRepository } from '../src/modules/business-intelligence/repositories/operations-control.repository';
import { OperationsReadRepository } from '../src/modules/business-intelligence/repositories/operations-read.repository';
import { createBiSystem, systemConfigured } from './fixtures/bi-system-environment';

function nativeUrl(value: string) { const url = new URL(value); url.search = ''; return url.toString(); }
const integration = systemConfigured() ? describe : describe.skip;
integration('BI complete CMS, independent CLI worker, backup and restricted permissions', () => {
  jest.setTimeout(120000);
  let system: Awaited<ReturnType<typeof createBiSystem>>; let app: INestApplication;
  let adminToken: string; let editorToken: string; let foreignToken: string;
  beforeAll(async () => {
    system = await createBiSystem(); app = await system.startApi();
    const login = async (email: string) => {
      const response = await request(app.getHttpServer()).post('/api/v1/auth/login').set('X-Auth-Mode', 'bearer')
        .send({ email, password: system.password }).expect(201);
      return response.body.data.tokens.accessToken as string;
    };
    adminToken = await login(system.users[0]!.admin.email); editorToken = await login(system.users[0]!.editor.email);
    foreignToken = await login(system.users[1]!.admin.email);
    await new WorkerControlRepository(system.target).heartbeat(randomUUID());
  });
  afterAll(async () => { await system?.close(); });
  const get = (path: string, token = adminToken) => request(app.getHttpServer()).get(`/api/v1/${path}`).auth(token, { type: 'bearer' });
  function create(key: string, token = adminToken) {
    return request(app.getHttpServer()).post('/api/v1/bi/requests').auth(token, { type: 'bearer' }).set('Idempotency-Key', key).send({ kind: 'manual' });
  }
  function worker(env = system.workerEnv, expectFailure = false) {
    let failed = false;
    try { execFileSync(process.execPath, ['-r', 'ts-node/register/transpile-only', 'src/modules/business-intelligence/etl.cli.ts', '--once'],
      { cwd: process.cwd(), env: { ...process.env, ...env }, stdio: 'pipe', timeout: 60000 }); }
    catch (error) { failed = true; if (!expectFailure) throw error; }
    expect(failed).toBe(expectFailure);
  }

  it('persists HTTP acceptance across API shutdown, executes outside HTTP and reconciles the authorized dashboard', async () => {
    const first = await create('system-close-page').expect(202); const id = first.body.data.id;
    expect((await get(`bi/requests/${id}`)).body.data.request.status).toBe('pending');
    expect((await get('bi/runs')).body.meta.total).toBe(0);
    await app.close(); worker(); app = await system.startApi();
    const detail = await get(`bi/requests/${id}`).expect(200);
    expect(detail.body.data.request.status).toBe('succeeded'); expect(detail.body.data.runs).toHaveLength(1);
    expect(detail.body.data.runs[0]).toMatchObject({ origin: 'manual', sourceCounts: { categories: '1', testimonials: '1', events: '4' } });
    const dashboard = await get('bi/dashboard', editorToken).expect(200);
    expect(dashboard.body.data.summary).toMatchObject({ totalTestimonials: 1, views: '2', clicks: '1', plays: '1', ctr: 50 });
    expect((await create('system-close-page').expect(202)).body.data.id).toBe(id);
    await get(`bi/requests/${id}`, foreignToken).expect(404);
    await create('editor-forbidden', editorToken).expect(403);
    expect((await get('bi/requests', foreignToken)).body.data).toEqual([]);
    const [time] = await system.target.$queryRaw<Array<{ snapshot: Date; run: Date; date: Date }>>`
      SELECT f.snapshot_at AS snapshot, r.source_snapshot_at AS run, f.snapshot_date_key AS date
      FROM dw.fact_testimonial_snapshot f JOIN etl.runs r ON r.tenant_id = f.tenant_id AND r.id = f.run_id
      WHERE f.tenant_id = ${system.users[0]!.company.id}::uuid`;
    expect(time?.snapshot).toEqual(time?.run); expect(time?.date.toISOString().slice(0, 10)).toBe(time?.snapshot.toISOString().slice(0, 10));
  });

  it('rolls back a failed publication, preserves the previous cut and durably records all three CLI attempts', async () => {
    const company = system.users[1]!.company;
    const old = new Date(hourUtc(new Date()).getTime() - 3600000);
    const warehouse = new WarehouseRepository(system.target); const lease = await warehouse.claim(company.id, old);
    if (!lease) throw new Error('Expected synthetic previous lease');
    const snapshot = { tenantId: company.id, name: company.name, isActive: true, at: old };
    await warehouse.snapshot(lease, snapshot); await warehouse.publish(lease, snapshot, { categories: 0n, testimonials: 0n, events: 0n });
    const previous = (await get('bi/dashboard', foreignToken)).body.data;
    await new WorkerControlRepository(system.target).heartbeat(randomUUID());
    const accepted = await create('system-failure', foreignToken).expect(202); const id = accepted.body.data.id;
    await system.target.$executeRawUnsafe("CREATE FUNCTION etl.system_reject_success() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status = 'succeeded' THEN RAISE EXCEPTION 'synthetic publication failure'; END IF; RETURN NEW; END $$");
    await system.target.$executeRawUnsafe('CREATE TRIGGER system_reject_success BEFORE UPDATE ON etl.load_requests FOR EACH ROW EXECUTE FUNCTION etl.system_reject_success()');
    try { worker(system.workerEnv, true); }
    finally { await system.target.$executeRawUnsafe('DROP TRIGGER system_reject_success ON etl.load_requests'); await system.target.$executeRawUnsafe('DROP FUNCTION etl.system_reject_success()'); }
    const detail = await get(`bi/requests/${id}`, foreignToken).expect(200);
    expect(detail.body.data.request.status).toBe('failed'); expect(detail.body.data.runs).toHaveLength(3);
    expect(detail.body.data.runs.every((run: { status: string }) => run.status === 'failed')).toBe(true);
    const after = (await get('bi/dashboard', foreignToken)).body.data;
    expect(after.summary).toEqual(previous.summary); expect(after.freshness.sourceSnapshotAt).toBe(previous.freshness.sourceSnapshotAt);
    expect((await get('bi/status', foreignToken)).body.data.alerts.some((alert: { code: string }) => alert.code === 'BI_LOAD_FAILED')).toBe(true);
    expect(JSON.stringify(detail.body)).not.toMatch(/synthetic publication failure|CREATE TRIGGER|Prisma|stack/);
  });

  it('backs up and restores every warehouse table, ACL, pending key and audit, then resumes without duplicates', async () => {
    const company = await system.source.tenant.create({ data: { name: 'Empresa BI sintética de restauración' } });
    const controls = new OperationsControlRepository({ write: work => system.target.$transaction(work) });
    const identity = { tenantId: company.id, actorId: system.users[0]!.admin.id };
    await controls.updateSettings(identity, { expectedVersion: 0, frequencyHours: 24, scheduleEnabled: false, delayToleranceMinutes: 120 });
    const receipt = await controls.createRequest(identity, 'restore-pending', { kind: 'manual' });
    const directory = await mkdtemp(join(tmpdir(), 'bi-system-backup-')); const file = join(directory, 'warehouse.dump');
    async function fingerprints(client: PrismaClient) {
      const tables = await client.$queryRaw<Array<{ schema: string; name: string }>>`
        SELECT schemaname AS schema, tablename AS name FROM pg_tables WHERE schemaname IN ('etl', 'staging', 'dw') ORDER BY 1, 2`;
      const result: Record<string, unknown> = {};
      for (const table of tables) {
        // System catalog names from our disposable database; quote identifiers independently.
        const identifier = [table.schema, table.name].map(value => '"' + value.replaceAll('"', '""') + '"').join('.');
        result[`${table.schema}.${table.name}`] = await client.$queryRawUnsafe(`SELECT count(*)::text AS count,
          md5(coalesce(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text), '')) AS digest FROM ${identifier} t`);
      }
      return result;
    }
    try {
      const before = await fingerprints(system.target);
      execFileSync('pg_dump', ['--format=custom', '--file', file, '--dbname', nativeUrl(system.targetUrl)], { stdio: 'pipe', timeout: 60000 });
      const restored = await system.restoreDatabase();
      execFileSync('pg_restore', ['--exit-on-error', '--single-transaction', '--no-owner', '--dbname', nativeUrl(restored.url), file], { stdio: 'pipe', timeout: 60000 });
      expect(await fingerprints(restored.client)).toEqual(before);
      const restoredControl = system.clientFor(system.roles.controlRole, restored.url);
      const restoredControls = new OperationsControlRepository({ write: work => restoredControl.$transaction(work) });
      expect((await restoredControls.createRequest(identity, 'restore-pending', { kind: 'manual' })).request.id).toBe(receipt.request.id);
      const restoredReader = system.clientFor(system.roles.readRole, restored.url);
      expect(await restoredReader.$queryRaw`SELECT count(*)::int AS count FROM dw.fact_tenant_snapshot`).toEqual([{ count: 2 }]);
      await expect(restoredControl.$executeRawUnsafe('UPDATE etl.runs SET status=status WHERE false')).rejects.toThrow();
      const restoredWorker = new URL(restored.url); restoredWorker.username = system.roles.writerRole;
      worker({ ...system.workerEnv, BI_ETL_DATABASE_URL: restoredWorker.toString() });
      const reads = new OperationsReadRepository({ read: work => restored.client.$transaction(work) });
      expect((await reads.request(company.id, receipt.request.id)).request.status).toBe('succeeded');
      expect((await reads.request(company.id, receipt.request.id)).runs).toHaveLength(1);
      worker({ ...system.workerEnv, BI_ETL_DATABASE_URL: restoredWorker.toString() });
      expect((await reads.request(company.id, receipt.request.id)).runs).toHaveLength(1);
      expect((await reads.settings(company.id))).toMatchObject({ frequencyHours: 24, delayToleranceMinutes: 120, scheduleEnabled: false });
    } finally { await rm(directory, { recursive: true, force: true }); }
  });

  it('enforces effective non-owner non-superuser control/read/writer privileges including forbidden DDL and fact writes', async () => {
    for (const role of [system.roles.controlRole, system.roles.readRole, system.roles.writerRole]) {
      const client = system.clientFor(role);
      const [effective] = await client.$queryRaw<Array<{ superuser: boolean; createRole: boolean; createDb: boolean; bypass: boolean; ddl: boolean; owner: boolean }>>`
        SELECT rolsuper AS superuser, rolcreaterole AS "createRole", rolcreatedb AS "createDb", rolbypassrls AS bypass,
          has_database_privilege(current_user, current_database(), 'CREATE') AS ddl,
          EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname IN ('etl','dw','staging') AND c.relowner=(SELECT oid FROM pg_roles WHERE rolname=current_user)) AS owner
        FROM pg_roles WHERE rolname=current_user`;
      expect(effective).toEqual({ superuser: false, createRole: false, createDb: false, bypass: false, ddl: false, owner: false });
      await expect(client.$executeRawUnsafe('CREATE TABLE etl.forbidden_system_test (id int)')).rejects.toThrow();
      await expect(client.$executeRawUnsafe("UPDATE etl.schema_migrations SET checksum = checksum WHERE false")).rejects.toThrow();
    }
    const control = system.clientFor(system.roles.controlRole); const reader = system.clientFor(system.roles.readRole);
    await expect(control.$executeRawUnsafe('UPDATE dw.fact_testimonial_snapshot SET rating = rating WHERE false')).rejects.toThrow();
    await expect(control.$executeRawUnsafe('UPDATE etl.runs SET status = status WHERE false')).rejects.toThrow();
    await expect(reader.$executeRawUnsafe('UPDATE etl.tenant_settings SET version = version WHERE false')).rejects.toThrow();
    await expect(system.clientFor(system.roles.writerRole).$executeRawUnsafe('DELETE FROM etl.control_audit WHERE false')).rejects.toThrow();
  });

  it('keeps CMS readiness, capture and moderation working while both BI HTTP identities lose warehouse access', async () => {
    for (const role of [system.roles.readRole, system.roles.controlRole]) await system.target.$executeRawUnsafe(`ALTER ROLE "${role}" NOLOGIN`);
    await system.target.$queryRaw`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=current_database()
      AND usename IN (${system.roles.readRole},${system.roles.controlRole}) AND pid<>pg_backend_pid()`;
    try {
      for (const path of ['bi/status', 'bi/dashboard']) {
        const response = await get(path).expect(503); expect(response.body.code).toBe('BI_UNAVAILABLE');
        expect(JSON.stringify(response.body)).not.toMatch(/postgresql:|Prisma|stack|SELECT|password/);
      }
      await create('not-accepted-during-outage').expect(503);
      await get('health/live').expect(200); await get('health/ready').expect(200); await get('testimonials?limit=20').expect(200);
      const captured = await request(app.getHttpServer()).post('/api/v1/testimonials').auth(adminToken, { type: 'bearer' })
        .send({ content: 'Testimonio sintético durante la caída analítica', authorName: 'Autor sintético', rating: 5 }).expect(201);
      await request(app.getHttpServer()).post(`/api/v1/testimonials/${captured.body.data.id}/submit`).auth(adminToken, { type: 'bearer' }).send({}).expect(201);
      await request(app.getHttpServer()).post(`/api/v1/testimonials/${captured.body.data.id}/approve`).auth(adminToken, { type: 'bearer' }).send({}).expect(201);
    } finally {
      for (const role of [system.roles.readRole, system.roles.controlRole]) await system.target.$executeRawUnsafe(`ALTER ROLE "${role}" LOGIN`);
    }
    expect((await get('bi/requests')).body.meta.total).toBe(1);
    await create('system-close-page').expect(202); // The original receipt survives the outage.
  });
});
