import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { EtlError, hourUtc, type Lease, type SourceSnapshot } from '../src/modules/business-intelligence/etl.types';
import { nextScheduledAt } from '../src/modules/business-intelligence/operations.types';
import { ManagedWarehouseRepository } from '../src/modules/business-intelligence/repositories/managed-warehouse.repository';
import { WorkerControlRepository } from '../src/modules/business-intelligence/repositories/worker-control.repository';
import { SourceRepository } from '../src/modules/business-intelligence/repositories/source.repository';
import { OperationsControlRepository } from '../src/modules/business-intelligence/repositories/operations-control.repository';
import { OperationsReadRepository } from '../src/modules/business-intelligence/repositories/operations-read.repository';
import { applyWarehouseMigration, migrationStatements } from '../src/modules/business-intelligence/repositories/warehouse-migrations';
import { EtlService } from '../src/modules/business-intelligence/services/etl.service';
import { EtlScheduler } from '../src/modules/business-intelligence/services/etl-scheduler';
import { installBiWarehouse } from './fixtures/bi-warehouse';

const sourceUrl = process.env.TEST_BI_SOURCE_DATABASE_URL; const targetUrl = process.env.TEST_BI_WAREHOUSE_DATABASE_URL;
const databaseTests = sourceUrl && targetUrl ? describe : describe.skip;
databaseTests('managed ETL protocol with two disposable PostgreSQL servers', () => {
  jest.setTimeout(30000);
  const suffix = randomUUID().replaceAll('-', ''); const sourceDb = `bi_worker_source_${suffix}`; const targetDb = `bi_worker_dw_${suffix}`;
  const extractorRole = `bi_worker_extract_${suffix}`; const writerRole = `bi_worker_write_${suffix}`;
  const tenantA = randomUUID(); const tenantB = randomUUID(); const actorId = randomUUID(); const identity = { tenantId: tenantA, actorId };
  let parentSource: PrismaClient; let parentTarget: PrismaClient; let sourceAdmin: PrismaClient; let admin: PrismaClient;
  let source: PrismaClient; let writer: PrismaClient; let warehouse: ManagedWarehouseRepository; let worker: WorkerControlRepository;
  let sourceRepo: SourceRepository; let service: EtlService; let controls: OperationsControlRepository; let reads: OperationsReadRepository;
  function connection(url: string, db: string, user?: string) {
    const parsed = new URL(url); parsed.pathname = `/${db}`; parsed.searchParams.set('connection_limit', '2');
    if (user) { parsed.username = user; parsed.password = ''; }
    return new PrismaClient({ datasources: { db: { url: parsed.toString() } } });
  }
  async function sqlFile(relative: string) {
    // Repository fixtures only: every call below uses a literal path.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return readFile(join(__dirname, relative), 'utf8');
  }
  beforeAll(async () => {
    parentSource = new PrismaClient({ datasources: { db: { url: sourceUrl! } } }); parentTarget = new PrismaClient({ datasources: { db: { url: targetUrl! } } });
    await parentSource.$executeRawUnsafe(`CREATE DATABASE "${sourceDb}"`); await parentTarget.$executeRawUnsafe(`CREATE DATABASE "${targetDb}"`);
    sourceAdmin = connection(sourceUrl!, sourceDb); admin = connection(targetUrl!, targetDb);
    await sourceAdmin.$transaction(async tx => {
      const sql = await sqlFile('fixtures/bi-source.sql'); const views = await sqlFile('../prisma/migrations/20261008010000_bi_export_views/migration.sql');
      for (const statement of [...migrationStatements(sql), ...migrationStatements(views)]) await tx.$executeRawUnsafe(statement);
    });
    await installBiWarehouse(admin);
    await expect(new WorkerControlRepository(admin).ready()).rejects.toMatchObject({ code: 'BI_MIGRATION_REQUIRED' });
    await applyWarehouseMigration(admin, '0004_bi_operations.sql', await sqlFile('../warehouse/migrations/0004_bi_operations.sql'));
    await parentSource.$executeRawUnsafe(`CREATE ROLE "${extractorRole}" LOGIN`); await parentTarget.$executeRawUnsafe(`CREATE ROLE "${writerRole}" LOGIN`);
    await sourceAdmin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA bi_export TO "${extractorRole}"`);
    await sourceAdmin.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA bi_export TO "${extractorRole}"`);
    await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA dw, staging, etl TO "${writerRole}"`);
    await admin.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA dw, staging TO "${writerRole}"`);
    await admin.$executeRawUnsafe(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA dw TO "${writerRole}"`);
    await admin.$executeRawUnsafe(`GRANT SELECT ON etl.schema_migrations TO "${writerRole}"`);
    await admin.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE ON etl.runs, etl.tenant_load_state, etl.tenant_settings, etl.worker_health TO "${writerRole}"`);
    await admin.$executeRawUnsafe(`GRANT SELECT, UPDATE ON etl.load_requests TO "${writerRole}"`);
    source = connection(sourceUrl!, sourceDb, extractorRole); writer = connection(targetUrl!, targetDb, writerRole);
    warehouse = new ManagedWarehouseRepository(writer); worker = new WorkerControlRepository(writer); sourceRepo = new SourceRepository(source, 1);
    service = new EtlService(sourceRepo, warehouse);
    controls = new OperationsControlRepository({ write: work => admin.$transaction(work) });
    reads = new OperationsReadRepository({ read: work => admin.$transaction(work) });
  });
  beforeEach(async () => {
    await admin.$executeRawUnsafe('TRUNCATE etl.tenant_settings, etl.load_requests, etl.control_audit, etl.worker_health, etl.tenant_load_state, etl.runs, dw.dim_tenant, dw.dim_date, dw.dim_status, dw.dim_event_type RESTART IDENTITY CASCADE');
    await sourceAdmin.$executeRawUnsafe('TRUNCATE tenants CASCADE');
    await sourceAdmin.$executeRaw`INSERT INTO tenants (id, name) VALUES (${tenantA}::uuid, 'Synthetic A'), (${tenantB}::uuid, 'Synthetic B')`;
  });
  afterAll(async () => {
    await Promise.allSettled([source?.$disconnect(), writer?.$disconnect(), sourceAdmin?.$disconnect(), admin?.$disconnect()]);
    if (parentSource) { await parentSource.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${sourceDb}" WITH (FORCE)`); await parentSource.$executeRawUnsafe(`DROP ROLE IF EXISTS "${extractorRole}"`); await parentSource.$disconnect(); }
    if (parentTarget) { await parentTarget.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${targetDb}" WITH (FORCE)`); await parentTarget.$executeRawUnsafe(`DROP ROLE IF EXISTS "${writerRole}"`); await parentTarget.$disconnect(); }
  });
  async function claimed() { const lease = await warehouse.claim(tenantA, hourUtc(new Date())); if (!lease) throw new Error('Expected lease'); return lease; }
  async function prepare(lease: Lease) {
    let snapshot: SourceSnapshot | undefined;
    const counts = await sourceRepo.extract(tenantA, { snapshot: async value => { snapshot = value; await warehouse.snapshot(lease, value); },
      categories: rows => warehouse.categories(lease, rows), testimonials: rows => warehouse.testimonials(lease, rows), events: rows => warehouse.events(lease, rows) });
    if (!snapshot) throw new Error('Expected snapshot'); await warehouse.extracted(lease, counts); return { snapshot, counts };
  }
  const filter = () => ({ from: new Date().toISOString().slice(0, 10), to: new Date().toISOString().slice(0, 10), page: 1, limit: 20 });

  it.each([1, 6, 24] as const)('aligns frequency %i in UTC, preserves preference versions and skips the same successful hour', async frequencyHours => {
    const settings = await controls.updateSettings(identity, { expectedVersion: 0, frequencyHours });
    expect((await service.runTenant(tenantA)).status).toBe('succeeded');
    expect(await reads.settings(tenantA)).toMatchObject({ frequencyHours, version: settings.version,
      nextScheduledAt: nextScheduledAt(new Date(), frequencyHours).toISOString() });
    expect((await service.runTenant(tenantA)).status).toBe('skipped');
    expect((await reads.runs(tenantA, filter())).items).toMatchObject([{ origin: 'scheduled', phase: 'publication',
      sourceCounts: { testimonials: '0', categories: '0', events: '0' }, destinationCounts: { testimonials: '0', engagement: '0' } }]);
  });
  it('keeps manual acceptance durable across client disconnection and publishes request/run/header atomically', async () => {
    const api = connection(targetUrl!, targetDb);
    let id: string;
    try { id = (await new OperationsControlRepository({ write: work => api.$transaction(work) }).createRequest(identity, 'close-page', { kind: 'manual' })).request.id; }
    finally { await api.$disconnect(); }
    const result = await service.runTenant(tenantA); const saved = await reads.request(tenantA, id);
    expect(saved.request.status).toBe('succeeded'); expect(saved.runs).toHaveLength(1);
    expect(saved.runs[0]).toMatchObject({ id: result.runId, origin: 'manual', finishedAt: saved.request.finishedAt });
    expect(await admin.$queryRaw`SELECT published_at FROM dw.fact_tenant_snapshot WHERE tenant_id = ${tenantA}::uuid`)
      .toEqual([{ published_at: new Date(saved.request.finishedAt!) }]);
    await expect(reads.request(tenantB, id)).rejects.toMatchObject({ kind: 'not_found' });
  });
  it('pauses automation, accepts manual work, and drains an active publication despite a later pause', async () => {
    await controls.updateSettings(identity, { expectedVersion: 0, scheduleEnabled: false });
    expect(await warehouse.claim(tenantA, hourUtc(new Date()))).toBeNull();
    const request = await controls.createRequest(identity, 'paused-manual', { kind: 'manual' });
    const lease = await claimed(); const data = await prepare(lease);
    await controls.updateSettings(identity, { expectedVersion: 1, scheduleEnabled: true });
    await controls.updateSettings(identity, { expectedVersion: 2, scheduleEnabled: false });
    await warehouse.publish(lease, data.snapshot, data.counts);
    expect((await reads.request(tenantA, request.request.id)).request.status).toBe('succeeded');
    expect(await reads.settings(tenantA)).toMatchObject({ scheduleEnabled: false, nextScheduledAt: null, version: 3 });
  });
  it('allows only one claim between two workers and uses the manual request rather than an extra scheduled run', async () => {
    const request = await controls.createRequest(identity, 'race', { kind: 'manual' });
    const second = new ManagedWarehouseRepository(writer);
    const outcomes = await Promise.all([warehouse.claim(tenantA, new Date()), second.claim(tenantA, new Date())]);
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect((await reads.request(tenantA, request.request.id)).runs).toMatchObject([{ origin: 'manual', attemptNo: 1 }]);
  });
  it('serializes manual acceptance against a simultaneous automatic claim', async () => {
    const outcomes = await Promise.allSettled([controls.createRequest(identity, 'automatic-race', { kind: 'manual' }), warehouse.claim(tenantA, new Date())]);
    expect(outcomes[1]).toMatchObject({ status: 'fulfilled', value: expect.objectContaining({ tenantId: tenantA }) });
    const requests = await reads.requests(tenantA, filter()); const runs = await reads.runs(tenantA, filter()); expect(runs.meta.total).toBe(1);
    if (outcomes[0]?.status === 'fulfilled') expect(runs.items[0]?.requestId).toBe(outcomes[0].value.request.id);
    else { expect(outcomes[0]).toMatchObject({ reason: { code: 'BI_ALREADY_RUNNING' } }); expect(requests.meta.total).toBe(0); }
  });
  it('recovers an expired reservation, preserves attempts and fences stale writes and releases', async () => {
    const request = await controls.createRequest(identity, 'recover', { kind: 'manual' }); const first = await claimed(); const data = await prepare(first);
    await admin.$executeRaw`UPDATE etl.tenant_load_state SET lease_until = '2000-01-01Z' WHERE tenant_id = ${tenantA}::uuid`;
    const next = await claimed(); expect(next.runId).not.toBe(first.runId);
    expect((await reads.request(tenantA, request.request.id)).runs.map(row => [row.attemptNo, row.status])).toEqual([[1, 'abandoned'], [2, 'running']]);
    await expect(warehouse.publish(first, data.snapshot, data.counts)).rejects.toMatchObject({ code: 'BI_LEASE_LOST' });
    await warehouse.fail(first, 'BI_ETL_FAILED'); expect(await warehouse.heartbeat(next)).toBe(true);
    const fresh = await prepare(next); await warehouse.publish(next, fresh.snapshot, fresh.counts);
    expect((await reads.request(tenantA, request.request.id)).request.status).toBe('succeeded');
  });
  it('recovers a running orphan without a lease instead of leaving its tenant blocked forever', async () => {
    const first = await claimed();
    await admin.$executeRaw`UPDATE etl.tenant_load_state SET lease_run_id = NULL, lease_token = NULL, lease_until = NULL WHERE tenant_id = ${tenantA}::uuid`;
    const second = await claimed(); expect(second.runId).not.toBe(first.runId); expect(await warehouse.status(first)).toBe('abandoned');
  });
  it('shares all three attempts with requests and records unknown counts for incomplete extraction', async () => {
    const request = await controls.createRequest(identity, 'failed', { kind: 'manual' });
    class FailingSource extends SourceRepository { override async extract(): Promise<never> { throw new EtlError('BI_SOURCE_INCONSISTENT'); } }
    const result = await new EtlService(new FailingSource(source), warehouse).runTenant(tenantA, undefined, 'cli');
    expect(result.status).toBe('failed');
    const saved = await reads.request(tenantA, request.request.id); expect(saved.request).toMatchObject({ status: 'failed', errorCode: 'BI_SOURCE_INCONSISTENT' });
    expect(saved.runs).toHaveLength(3); expect(saved.runs.every(row => row.sourceCounts === null)).toBe(true);
    await controls.updateSettings(identity, { expectedVersion: 1, frequencyHours: 6 });
    expect(await warehouse.claim(tenantA, new Date())).toBeNull(); expect((await reads.runs(tenantA, filter())).meta.total).toBe(3);
  });
  it('rolls back facts and run success when the final request transition fails', async () => {
    const request = await controls.createRequest(identity, 'atomic', { kind: 'manual' }); const lease = await claimed(); const data = await prepare(lease);
    await admin.$executeRawUnsafe("CREATE FUNCTION etl.reject_success() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status = 'succeeded' THEN RAISE EXCEPTION 'synthetic'; END IF; RETURN NEW; END $$");
    await admin.$executeRawUnsafe('CREATE TRIGGER reject_success BEFORE UPDATE ON etl.load_requests FOR EACH ROW EXECUTE FUNCTION etl.reject_success()');
    try {
      await expect(warehouse.publish(lease, data.snapshot, data.counts)).rejects.toThrow();
      expect(await warehouse.status(lease)).toBe('running'); expect((await reads.request(tenantA, request.request.id)).request.status).toBe('running');
      expect(await admin.$queryRaw`SELECT count(*) AS count FROM dw.fact_tenant_snapshot WHERE tenant_id = ${tenantA}::uuid`).toEqual([{ count: 0n }]);
      expect(await admin.$queryRaw`SELECT count(*) AS count FROM dw.dim_tenant WHERE tenant_id = ${tenantA}::uuid`).toEqual([{ count: 0n }]);
    } finally { await admin.$executeRawUnsafe('DROP TRIGGER reject_success ON etl.load_requests'); await admin.$executeRawUnsafe('DROP FUNCTION etl.reject_success()'); }
    await warehouse.publish(lease, data.snapshot, data.counts); expect((await reads.request(tenantA, request.request.id)).request.status).toBe('succeeded');
  });
  it('resolves a lost response after COMMIT using the successful run and request without another attempt', async () => {
    class Ambiguous extends ManagedWarehouseRepository { override async publish(...args: Parameters<ManagedWarehouseRepository['publish']>) { await super.publish(...args); throw new Error('synthetic lost response'); } }
    const request = await controls.createRequest(identity, 'commit', { kind: 'manual' });
    expect((await new EtlService(sourceRepo, new Ambiguous(writer)).runTenant(tenantA)).status).toBe('succeeded');
    const saved = await reads.request(tenantA, request.request.id); expect(saved.request.status).toBe('succeeded'); expect(saved.runs).toHaveLength(1);
  });
  it('expires an unstarted previous-hour request during a pause without manufacturing a historical cut', async () => {
    await controls.updateSettings(identity, { expectedVersion: 0, scheduleEnabled: false });
    const request = await controls.createRequest(identity, 'expired', { kind: 'manual' });
    await admin.$executeRaw`UPDATE etl.load_requests SET slot_at = slot_at - interval '1 hour', expires_at = expires_at - interval '1 hour',
      created_at = created_at - interval '1 hour' WHERE tenant_id = ${tenantA}::uuid`;
    expect(await warehouse.claim(tenantA, new Date())).toBeNull();
    const saved = await reads.request(tenantA, request.request.id); expect(saved.request.status).toBe('expired'); expect(saved.runs).toHaveLength(0);
  });
  it('ends an expired running request after restart and retries only a current observation linked to the old failure', async () => {
    await controls.updateSettings(identity, { expectedVersion: 0, scheduleEnabled: false });
    const oldId = randomUUID(); const oldRun = randomUUID(); const slot = new Date(hourUtc(new Date()).getTime() - 3600000);
    await admin.$executeRaw`INSERT INTO etl.load_requests (id, tenant_id, actor_id, kind, idempotency_key, payload_hash,
      slot_at, expires_at, status, created_at, started_at) VALUES (${oldId}::uuid, ${tenantA}::uuid, ${actorId}::uuid, 'manual',
      'old-running', repeat('a',64), ${slot}, ${new Date(slot.getTime() + 3600000)}, 'running', ${new Date(slot.getTime() + 1)}, ${new Date(slot.getTime() + 2)})`;
    await admin.$executeRaw`INSERT INTO etl.runs (id, tenant_id, slot_at, attempt_no, status, started_at, origin, request_id, phase)
      VALUES (${oldRun}::uuid, ${tenantA}::uuid, ${slot}, 1, 'running', ${new Date(slot.getTime() + 2)}, 'manual', ${oldId}::uuid, 'extraction')`;
    await admin.$executeRaw`INSERT INTO etl.tenant_load_state (tenant_id, lease_run_id, lease_token, lease_until)
      VALUES (${tenantA}::uuid, ${oldRun}::uuid, ${randomUUID()}::uuid, '2000-01-01Z')`;
    expect(await warehouse.claim(tenantA, new Date())).toBeNull();
    const old = await reads.request(tenantA, oldId); expect(old.request.status).toBe('failed'); expect(old.runs[0]?.status).toBe('abandoned');
    const retry = await controls.createRequest(identity, 'retry-current', { kind: 'retry', retryOfRunId: oldRun });
    expect((await service.runTenant(tenantA)).status).toBe('succeeded');
    const saved = await reads.request(tenantA, retry.request.id); expect(saved.runs[0]).toMatchObject({ origin: 'retry', attemptNo: 1,
      slotAt: hourUtc(new Date()).toISOString() });
    expect(await admin.$queryRaw`SELECT count(*) AS count FROM dw.fact_tenant_snapshot WHERE tenant_id = ${tenantA}::uuid`).toEqual([{ count: 1n }]);
  });
  it('keeps an active request running between bounded attempts and records the extraction phase until totals are known', async () => {
    const request = await controls.createRequest(identity, 'progress', { kind: 'manual' }); const lease = await claimed();
    const before = (await reads.request(tenantA, request.request.id)).runs[0];
    expect(before).toMatchObject({ phase: 'extraction', sourceCounts: null, destinationCounts: null });
    await warehouse.fail(lease, 'BI_ETL_FAILED');
    expect((await reads.request(tenantA, request.request.id)).request.status).toBe('running');
    const next = await claimed(); await prepare(next);
    expect((await reads.run(tenantA, next.runId))).toMatchObject({ phase: 'publication', sourceCounts: { categories: '0', testimonials: '0', events: '0' }, destinationCounts: null });
  });
  it('does not claim a cancelled pending request even when automation is paused', async () => {
    await controls.updateSettings(identity, { expectedVersion: 0, scheduleEnabled: false });
    const request = await controls.createRequest(identity, 'cancel', { kind: 'manual' }); await controls.cancelRequest(identity, request.request.id, 'cancel-key');
    expect(await warehouse.claim(tenantA, new Date())).toBeNull(); expect((await reads.request(tenantA, request.request.id)).request.status).toBe('cancelled');
  });
  it('serializes cancellation against claim without cancelling a running load', async () => {
    await controls.updateSettings(identity, { expectedVersion: 0, scheduleEnabled: false });
    const request = await controls.createRequest(identity, 'cancel-race', { kind: 'manual' });
    const outcomes = await Promise.allSettled([controls.cancelRequest(identity, request.request.id, 'cancel-race-key'), warehouse.claim(tenantA, new Date())]);
    const saved = await reads.request(tenantA, request.request.id);
    if (saved.request.status === 'cancelled') {
      expect(outcomes[0]).toMatchObject({ status: 'fulfilled' }); expect(outcomes[1]).toMatchObject({ status: 'fulfilled', value: null }); expect(saved.runs).toHaveLength(0);
    } else {
      expect(saved.request.status).toBe('running'); expect(outcomes[0]).toMatchObject({ reason: { code: 'BI_REQUEST_NOT_PENDING' } }); expect(saved.runs).toHaveLength(1);
    }
  });
  it('provisions inventory in pages without overwriting settings and completes a bounded scheduler sweep', async () => {
    await controls.updateSettings(identity, { expectedVersion: 0, scheduleEnabled: false });
    const scheduler = new EtlScheduler(sourceRepo, worker, service); const results = [];
    for await (const result of scheduler.tick(new AbortController().signal, 'cli')) results.push(result);
    expect(results).toMatchObject([{ tenantId: tenantB, status: 'succeeded' }]);
    expect(await reads.settings(tenantA)).toMatchObject({ scheduleEnabled: false, version: 1 });
    expect((await reads.runs(tenantB, filter())).items[0]?.origin).toBe('cli');
  });
  it('stores worker liveness and stop state while forbidding DDL, audit changes and request creation for its SQL identity', async () => {
    await worker.ready(); const workerId = randomUUID(); await worker.heartbeat(workerId); await worker.heartbeat(workerId, true);
    expect(await admin.$queryRaw`SELECT protocol_version, stopping, last_seen_at >= started_at AS valid FROM etl.worker_health WHERE worker_id = ${workerId}::uuid`)
      .toEqual([{ protocol_version: 1, stopping: true, valid: true }]);
    await expect(writer.$executeRaw`DELETE FROM etl.control_audit`).rejects.toThrow();
    await expect(writer.$executeRaw`CREATE TABLE etl.forbidden (id int)`).rejects.toThrow();
    await expect(writer.$executeRaw`INSERT INTO etl.schema_migrations (version, checksum) VALUES ('forbidden', repeat('a',64))`).rejects.toThrow();
  });
});
