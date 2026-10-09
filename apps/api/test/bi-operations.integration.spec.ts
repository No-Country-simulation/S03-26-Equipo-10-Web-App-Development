import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { BiControlConnection } from '../src/modules/business-intelligence/repositories/bi-control-connection';
import { OperationsControlRepository } from '../src/modules/business-intelligence/repositories/operations-control.repository';
import { OperationsReadRepository } from '../src/modules/business-intelligence/repositories/operations-read.repository';
import { applyWarehouseMigration } from '../src/modules/business-intelligence/repositories/warehouse-migrations';
import { WarehouseRepository } from '../src/modules/business-intelligence/repositories/warehouse.repository';
import { hourUtc } from '../src/modules/business-intelligence/etl.types';
import { installBiWarehouse } from './fixtures/bi-warehouse';
import { restoreEnvironment } from './fixtures/bi-control-environment';
import { lockOperationsTenant } from '../src/modules/business-intelligence/repositories/operations-records';

const adminUrl = process.env.TEST_BI_WAREHOUSE_DATABASE_URL;
const databaseTests = adminUrl ? describe : describe.skip;
databaseTests('BI control persistence in disposable PostgreSQL 18', () => {
  jest.setTimeout(30000);
  const suffix = randomUUID().replaceAll('-', ''); const database = `bi_ops_${suffix}`;
  const controlRole = `bi_control_${suffix}`; const readerRole = `bi_ops_read_${suffix}`;
  const tenantA = randomUUID(); const tenantB = randomUUID(); const actor = randomUUID();
  const identity = { tenantId: tenantA, actorId: actor };
  let parent: PrismaClient; let admin: PrismaClient; let restricted: PrismaClient; let reader: PrismaClient;
  let control: BiControlConnection; let repository: OperationsControlRepository; let reads: OperationsReadRepository;
  let sql: string;
  function url(user?: string) {
    const parsed = new URL(adminUrl!); parsed.pathname = `/${database}`; parsed.searchParams.set('connection_limit', '2');
    if (user) { parsed.username = user; parsed.password = ''; }
    return parsed.toString();
  }
  beforeAll(async () => {
    parent = new PrismaClient({ datasources: { db: { url: adminUrl! } } });
    await parent.$executeRawUnsafe(`CREATE DATABASE "${database}"`);
    await parent.$executeRawUnsafe(`CREATE ROLE "${controlRole}" LOGIN`);
    await parent.$executeRawUnsafe(`CREATE ROLE "${readerRole}" LOGIN`);
    admin = new PrismaClient({ datasources: { db: { url: url() } } });
    restricted = new PrismaClient({ datasources: { db: { url: url(controlRole) } } });
    reader = new PrismaClient({ datasources: { db: { url: url(readerRole) } } });
    // Fixed repository migration; never an input path.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    sql = await readFile(join(__dirname, '../warehouse/migrations/0004_bi_operations.sql'), 'utf8');
    const previous = { BI_ENABLED: process.env.BI_ENABLED, BI_OPERATIONS_ENABLED: process.env.BI_OPERATIONS_ENABLED, BI_CONTROL_DATABASE_URL: process.env.BI_CONTROL_DATABASE_URL };
    try {
      process.env.BI_ENABLED = 'true'; process.env.BI_OPERATIONS_ENABLED = 'true'; process.env.BI_CONTROL_DATABASE_URL = url(controlRole);
      control = new BiControlConnection(); repository = new OperationsControlRepository(control);
    } finally {
      restoreEnvironment(previous);
    }
    reads = new OperationsReadRepository({ read: work => reader.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`; await tx.$executeRaw`SET LOCAL timezone = 'UTC'`; return work(tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }) });
  });
  beforeEach(async () => {
    await admin.$executeRawUnsafe('DROP SCHEMA IF EXISTS staging, dw, etl CASCADE');
    await installBiWarehouse(admin); await applyWarehouseMigration(admin, '0004_bi_operations.sql', sql);
    await admin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA etl TO "${controlRole}", "${readerRole}"`);
    await admin.$executeRawUnsafe(`GRANT SELECT ON etl.tenant_settings, etl.load_requests, etl.control_audit, etl.runs, etl.tenant_load_state TO "${controlRole}"`);
    await admin.$executeRawUnsafe(`GRANT INSERT ON etl.tenant_settings, etl.load_requests, etl.control_audit TO "${controlRole}"`);
    await admin.$executeRawUnsafe(`GRANT UPDATE ON etl.tenant_settings TO "${controlRole}"`);
    await admin.$executeRawUnsafe(`GRANT UPDATE (status, finished_at, error_code) ON etl.load_requests TO "${controlRole}"`);
    await admin.$executeRawUnsafe(`GRANT SELECT ON etl.tenant_settings, etl.load_requests, etl.control_audit, etl.runs, etl.tenant_load_state, etl.worker_health TO "${readerRole}"`);
  });
  afterAll(async () => {
    await control?.onModuleDestroy(); await Promise.allSettled([admin?.$disconnect(), restricted?.$disconnect(), reader?.$disconnect()]);
    if (parent) {
      await parent.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
      await parent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${controlRole}"`); await parent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${readerRole}"`);
      await parent.$disconnect();
    }
  });
  const filter = () => { const day = new Date().toISOString().slice(0, 10); return { from: day, to: day, page: 1, limit: 20 }; };
  async function run(tenantId: string, attempt: number, status: 'failed' | 'succeeded' = 'failed') {
    const id = randomUUID();
    await admin.$executeRaw`INSERT INTO etl.runs
      (id, tenant_id, slot_at, attempt_no, status, started_at, source_snapshot_at, finished_at, error_code)
      VALUES (${id}::uuid, ${tenantId}::uuid, ${hourUtc(new Date())}, ${attempt}, ${status},
        clock_timestamp() - interval '1 second', date_trunc('milliseconds', clock_timestamp()), clock_timestamp(),
        ${status === 'failed' ? 'BI_ETL_FAILED' : null})`;
    return id;
  }

  it('preserves migration checksums and legacy history on expansion and repetition', async () => {
    await admin.$executeRawUnsafe('DROP SCHEMA staging, dw, etl CASCADE'); await installBiWarehouse(admin);
    const old = await run(tenantA, 1);
    const ledger = await admin.$queryRaw`SELECT version, checksum FROM etl.schema_migrations ORDER BY version`;
    expect(await applyWarehouseMigration(admin, '0004_bi_operations.sql', sql)).toBe(true);
    expect(await applyWarehouseMigration(admin, '0004_bi_operations.sql', sql)).toBe(false);
    expect(await admin.$queryRaw`SELECT version, checksum FROM etl.schema_migrations WHERE version <> '0004_bi_operations.sql' ORDER BY version`).toEqual(ledger);
    expect(await admin.$queryRaw`SELECT id, origin, phase, request_id FROM etl.runs WHERE tenant_id = ${tenantA}::uuid`)
      .toEqual([{ id: old, origin: 'legacy', phase: null, request_id: null }]);
    await expect(applyWarehouseMigration(admin, '0004_bi_operations.sql', sql + '-- drift\n')).rejects.toMatchObject({ code: 'BI_MIGRATION_DRIFT' });
  });
  it('requires 0003 and refuses running jobs or expired leases before changing schema', async () => {
    await admin.$executeRawUnsafe('DROP SCHEMA staging, dw, etl CASCADE');
    // Fixed repository migration; never an input path.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const initial = await readFile(join(__dirname, '../warehouse/migrations/0001_initial.sql'), 'utf8');
    await applyWarehouseMigration(admin, '0001_initial.sql', initial);
    await expect(applyWarehouseMigration(admin, '0004_bi_operations.sql', sql)).rejects.toMatchObject({ code: 'BI_MIGRATION_INVALID' });
    await installBiWarehouse(admin);
    const warehouse = new WarehouseRepository(admin); const lease = await warehouse.claim(tenantA, hourUtc(new Date())); expect(lease).not.toBeNull();
    await expect(applyWarehouseMigration(admin, '0004_bi_operations.sql', sql)).rejects.toMatchObject({ code: 'BI_MAINTENANCE_REQUIRED' });
    await admin.$executeRaw`UPDATE etl.runs SET status = 'failed', finished_at = clock_timestamp(), error_code = 'BI_ETL_FAILED' WHERE tenant_id = ${tenantA}::uuid`;
    await admin.$executeRaw`UPDATE etl.tenant_load_state SET lease_until = '2020-01-01Z' WHERE tenant_id = ${tenantA}::uuid`;
    await expect(applyWarehouseMigration(admin, '0004_bi_operations.sql', sql)).rejects.toMatchObject({ code: 'BI_MAINTENANCE_REQUIRED' });
    expect(await admin.$queryRaw`SELECT to_regclass('etl.load_requests')::text AS table`).toEqual([{ table: null }]);
  });
  it('reads defaults without writing and atomically versions settings with audit before the first warehouse cut', async () => {
    expect(await reads.settings(tenantA)).toMatchObject({ version: 0, frequencyHours: 1, alertFailures: true, delayToleranceMinutes: 60 });
    expect(await admin.$queryRaw`SELECT count(*) AS count FROM etl.tenant_settings`).toEqual([{ count: 0n }]);
    expect(await repository.updateSettings(identity, { expectedVersion: 0, frequencyHours: 24 })).toMatchObject({ version: 1, frequencyHours: 24 });
    const paused = await repository.updateSettings(identity, { expectedVersion: 1, scheduleEnabled: false });
    expect(paused.nextScheduledAt).toBeNull();
    const resumed = await repository.updateSettings(identity, { expectedVersion: 2, scheduleEnabled: true });
    expect(resumed.nextScheduledAt).toBe(hourUtc(new Date()).toISOString());
    expect((await reads.audit(tenantA, filter())).meta.total).toBe(3);
    expect((await reads.settings(tenantB)).version).toBe(0);
  });
  it('rejects concurrent stale settings versions rather than overwriting another administrator', async () => {
    const outcomes = await Promise.allSettled([
      repository.updateSettings(identity, { expectedVersion: 0, frequencyHours: 6 }),
      repository.updateSettings(identity, { expectedVersion: 0, frequencyHours: 24 }),
    ]);
    expect(outcomes.filter(x => x.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.find(x => x.status === 'rejected')).toMatchObject({ reason: { code: 'BI_SETTINGS_CONFLICT' } });
    expect((await reads.audit(tenantA, filter())).meta.total).toBe(1);
  });
  it('bounds contention across UUID casing and resumes without partial requests after releasing the tenant lock', async () => {
    let locked!: () => void; let release!: () => void;
    const ready = new Promise<void>(resolve => { locked = resolve; }); const resume = new Promise<void>(resolve => { release = resolve; });
    const pending = admin.$transaction(async tx => { await lockOperationsTenant(tx, tenantA); locked(); await resume; }, { timeout: 15000 });
    const settled = pending.then(() => undefined, () => undefined);
    try {
      await Promise.race([ready, pending.then(() => { throw new Error('Expected lock holder'); })]);
      await expect(repository.createRequest({ ...identity, tenantId: tenantA.toUpperCase() }, 'blocked', { kind: 'manual' })).rejects.toMatchObject({ code: 'BI_OPERATION_BUSY' });
      expect((await reads.requests(tenantA, filter())).meta.total).toBe(0);
      release(); await pending;
      expect((await repository.createRequest(identity, 'blocked', { kind: 'manual' })).request.status).toBe('pending');
    } finally { release(); await settled; }
  });
  it('persists one request and one audit for concurrent identical keys and can read it from another session', async () => {
    const results = await Promise.all([repository.createRequest(identity, 'same', { kind: 'manual' }), repository.createRequest(identity, 'same', { kind: 'manual' })]);
    expect(results[0]?.request.id).toBe(results[1]?.request.id);
    expect(results.map(x => x.replayed).sort()).toEqual([false, true]);
    expect((await reads.requests(tenantA, filter())).meta.total).toBe(1);
    expect((await reads.audit(tenantA, filter())).meta.total).toBe(1);
    const saved = results[0]!.request;
    expect(await reads.request(tenantA, saved.id)).toEqual({ request: saved, runs: [] });
    expect(saved.expiresAt).toBe(new Date(Date.parse(saved.slotAt) + 3600000).toISOString());
  });
  it('rejects a competing key, preserves key-to-payload binding and isolates actors and tenants', async () => {
    const failed = await run(tenantA, 1);
    await repository.createRequest(identity, 'key', { kind: 'manual' });
    await expect(repository.createRequest(identity, 'second', { kind: 'manual' })).rejects.toMatchObject({ code: 'BI_REQUEST_CONFLICT' });
    await expect(repository.createRequest(identity, 'key', { kind: 'retry', retryOfRunId: failed })).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    const foreign = await repository.createRequest({ tenantId: tenantB, actorId: actor }, 'key', { kind: 'manual' });
    await expect(reads.request(tenantA, foreign.request.id)).rejects.toMatchObject({ kind: 'not_found' });
    await expect(repository.cancelRequest(identity, foreign.request.id, 'cancel')).rejects.toMatchObject({ kind: 'not_found' });
    expect((await reads.requests(tenantB, filter())).meta.total).toBe(1);
  });
  it('does not reset the hourly budget after settings changes and rejects success in the same hour', async () => {
    await run(tenantA, 1); await run(tenantA, 2); await run(tenantA, 3);
    await repository.updateSettings(identity, { expectedVersion: 0, frequencyHours: 24 });
    await expect(repository.createRequest(identity, 'limit', { kind: 'manual' })).rejects.toMatchObject({ code: 'BI_ATTEMPTS_EXHAUSTED' });
    await run(tenantB, 1, 'succeeded');
    await expect(repository.createRequest({ tenantId: tenantB, actorId: actor }, 'done', { kind: 'manual' })).rejects.toMatchObject({ code: 'BI_ALREADY_SUCCEEDED' });
  });
  it('permits manual work while paused but refuses an active or expired worker reservation', async () => {
    await repository.updateSettings(identity, { expectedVersion: 0, scheduleEnabled: false });
    expect((await repository.createRequest(identity, 'paused', { kind: 'manual' })).request.status).toBe('pending');
    const warehouse = new WarehouseRepository(admin); const lease = await warehouse.claim(tenantB, hourUtc(new Date())); expect(lease).not.toBeNull();
    const other = { tenantId: tenantB, actorId: actor };
    await expect(repository.createRequest(other, 'active', { kind: 'manual' })).rejects.toMatchObject({ code: 'BI_ALREADY_RUNNING' });
    await admin.$executeRaw`UPDATE etl.tenant_load_state SET lease_until = '2020-01-01Z' WHERE tenant_id = ${tenantB}::uuid`;
    await expect(repository.createRequest(other, 'expired', { kind: 'manual' })).rejects.toMatchObject({ code: 'BI_RECOVERY_REQUIRED' });
  });
  it('links retry only to a failed or abandoned run of the same tenant', async () => {
    const failed = await run(tenantA, 1); const other = await run(tenantB, 1, 'succeeded');
    await expect(repository.createRequest(identity, 'foreign', { kind: 'retry', retryOfRunId: other })).rejects.toMatchObject({ kind: 'not_found' });
    expect((await repository.createRequest(identity, 'retry', { kind: 'retry', retryOfRunId: failed })).request.retryOfRunId).toBe(failed);
    await expect(repository.createRequest({ tenantId: tenantB, actorId: actor }, 'success', { kind: 'retry', retryOfRunId: other }))
      .rejects.toMatchObject({ code: 'BI_RETRY_NOT_ALLOWED' });
  });
  it('cancels pending requests once, replays cancellation keys and rejects key reuse or active cancellation', async () => {
    const first = await repository.createRequest(identity, 'first', { kind: 'manual' });
    const cancelled = await repository.cancelRequest(identity, first.request.id, 'cancel'); expect(cancelled.status).toBe('cancelled');
    expect(await repository.cancelRequest(identity, first.request.id, 'cancel')).toEqual(cancelled);
    const second = await repository.createRequest(identity, 'second', { kind: 'manual' });
    await expect(repository.cancelRequest(identity, second.request.id, 'cancel')).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
    await admin.$executeRaw`UPDATE etl.load_requests SET status = 'running', started_at = clock_timestamp()
      WHERE tenant_id = ${tenantA}::uuid AND id = ${second.request.id}::uuid`;
    await expect(repository.cancelRequest(identity, second.request.id, 'active')).rejects.toMatchObject({ code: 'BI_REQUEST_NOT_PENDING' });
    expect((await reads.audit(tenantA, filter())).items.filter(x => x.action === 'request_cancelled')).toHaveLength(1);
    // Reusing a creation key returns its original ID even after cancellation.
    expect((await repository.createRequest(identity, 'first', { kind: 'manual' })).request.id).toBe(first.request.id);
  });
  it('expires an unstarted prior-hour request without treating it as a new-hour job', async () => {
    const first = await repository.createRequest(identity, 'old', { kind: 'manual' });
    await admin.$executeRaw`UPDATE etl.load_requests SET slot_at = slot_at - interval '1 hour',
      expires_at = expires_at - interval '1 hour', created_at = created_at - interval '1 hour'
      WHERE tenant_id = ${tenantA}::uuid AND id = ${first.request.id}::uuid`;
    const next = await repository.createRequest(identity, 'new', { kind: 'manual' });
    expect(next.request.slotAt).toBe(hourUtc(new Date()).toISOString());
    expect((await reads.request(tenantA, first.request.id)).request).toMatchObject({ status: 'expired', errorCode: 'BI_REQUEST_EXPIRED' });
  });
  it('rolls back both settings and request creation when their audit cannot be persisted', async () => {
    await admin.$executeRawUnsafe(`REVOKE INSERT ON etl.control_audit FROM "${controlRole}"`);
    await expect(repository.updateSettings(identity, { expectedVersion: 0, frequencyHours: 6 })).rejects.toMatchObject({ code: 'BI_UNAVAILABLE' });
    await expect(repository.createRequest(identity, 'audit-failed', { kind: 'manual' })).rejects.toMatchObject({ code: 'BI_UNAVAILABLE' });
    expect(await admin.$queryRaw`SELECT (SELECT count(*) FROM etl.tenant_settings) AS settings,
      (SELECT count(*) FROM etl.load_requests) AS requests`).toEqual([{ settings: 0n, requests: 0n }]);
  });
  it('uses tenant-aware foreign keys and rejects invalid cadence, state, timestamps and unsafe audit metadata', async () => {
    const first = await repository.createRequest(identity, 'first', { kind: 'manual' });
    const otherRun = await run(tenantB, 1);
    await expect(admin.$executeRaw`UPDATE etl.load_requests SET kind = 'retry', retry_of_run_id = ${otherRun}::uuid
      WHERE tenant_id = ${tenantA}::uuid`).rejects.toThrow();
    await expect(admin.$executeRaw`UPDATE etl.runs SET origin = 'manual', request_id = ${first.request.id}::uuid WHERE tenant_id = ${tenantB}::uuid`).rejects.toThrow();
    await expect(admin.$executeRaw`INSERT INTO etl.control_audit (tenant_id, actor_id, action, request_id)
      VALUES (${tenantB}::uuid, ${actor}::uuid, 'request_created', ${first.request.id}::uuid)`).rejects.toThrow();
    await expect(admin.$executeRaw`INSERT INTO etl.load_requests
      (tenant_id, actor_id, kind, idempotency_key, payload_hash, slot_at, expires_at, created_at)
      SELECT tenant_id, actor_id, kind, 'different-key', payload_hash, slot_at, expires_at, created_at
      FROM etl.load_requests WHERE tenant_id = ${tenantA}::uuid`).rejects.toThrow();
    await expect(admin.$executeRaw`UPDATE etl.load_requests SET status = 'succeeded' WHERE tenant_id = ${tenantA}::uuid`).rejects.toThrow();
    await expect(admin.$executeRaw`UPDATE etl.load_requests SET expires_at = expires_at + interval '1 hour' WHERE tenant_id = ${tenantA}::uuid`).rejects.toThrow();
    await expect(admin.$executeRaw`INSERT INTO etl.tenant_settings (tenant_id, frequency_hours) VALUES (${tenantB}::uuid, 2)`).rejects.toThrow();
    await admin.$executeRaw`INSERT INTO etl.tenant_settings (tenant_id) VALUES (${tenantB}::uuid)`;
    expect(await reads.settings(tenantB)).toMatchObject({ frequencyHours: 1, scheduleEnabled: true, version: 1,
      nextScheduledAt: hourUtc(new Date()).toISOString() });
    await repository.updateSettings(identity, { expectedVersion: 0, frequencyHours: 6 });
    await expect(admin.$executeRaw`UPDATE etl.control_audit SET settings_after = settings_after || '{"secret":"forbidden"}'::jsonb
      WHERE tenant_id = ${tenantA}::uuid AND action = 'settings_updated'`).rejects.toThrow();
  });
  it('reads paginated tenant history with unknown source counts distinct from completed empty extraction', async () => {
    const incomplete = await run(tenantA, 1); const complete = await run(tenantA, 2); const other = await run(tenantB, 1);
    await admin.$executeRaw`UPDATE etl.runs SET extraction_completed_at = finished_at, phase = 'publication', origin = 'cli'
      WHERE tenant_id = ${tenantA}::uuid AND id = ${complete}::uuid`;
    const rows = await reads.runs(tenantA, { ...filter(), limit: 1 }); expect(rows.meta.total).toBe(2); expect(rows.items).toHaveLength(1);
    expect((await reads.run(tenantA, incomplete)).sourceCounts).toBeNull();
    expect((await reads.run(tenantA, complete)).sourceCounts).toEqual({ categories: '0', testimonials: '0', events: '0' });
    await admin.$executeRaw`UPDATE etl.runs SET source_event_count = 9007199254740993 WHERE tenant_id = ${tenantA}::uuid AND id = ${complete}::uuid`;
    expect((await reads.run(tenantA, complete)).sourceCounts?.events).toBe('9007199254740993');
    expect((await reads.runs(tenantA, { ...filter(), origin: 'cli' })).meta.total).toBe(1);
    await expect(reads.run(tenantA, other)).rejects.toMatchObject({ kind: 'not_found' });
    expect(() => reads.runs(tenantA, { ...filter(), limit: 101 })).toThrow();
  });
  it('denies writes to facts, runs, leases, ledger, worker health and prior audit under the control identity', async () => {
    for (const table of ['dw.fact_tenant_snapshot', 'etl.runs', 'etl.tenant_load_state', 'etl.schema_migrations', 'etl.worker_health', 'etl.control_audit']) {
      // Fixed allowlist of repository table names, not caller input.
      await expect(restricted.$executeRawUnsafe(`DELETE FROM ${table}`)).rejects.toThrow();
    }
    await expect(restricted.$executeRaw`UPDATE etl.runs SET origin = 'cli' WHERE tenant_id = ${tenantA}::uuid`).rejects.toThrow();
    await expect(restricted.$executeRaw`CREATE TABLE etl.forbidden (id int)`).rejects.toThrow();
    await expect(reader.$executeRaw`INSERT INTO etl.worker_health (worker_id, protocol_version) VALUES (${randomUUID()}::uuid, 1)`).rejects.toThrow();
  });
  it('keeps existing publication ACID and usable on the expanded schema with a legacy-origin empty cut', async () => {
    const warehouse = new WarehouseRepository(admin); const lease = await warehouse.claim(tenantA, hourUtc(new Date())); expect(lease).not.toBeNull();
    if (!lease) throw new Error('Expected lease');
    const snapshot = { tenantId: tenantA, name: 'Synthetic empty', isActive: true, at: new Date() };
    await warehouse.snapshot(lease, snapshot); await warehouse.publish(lease, snapshot, { categories: 0n, testimonials: 0n, events: 0n });
    expect(await reads.run(tenantA, lease.runId)).toMatchObject({ origin: 'legacy', status: 'succeeded', sourceCounts: { categories: '0', testimonials: '0', events: '0' } });
    expect(await admin.$queryRaw`SELECT testimonial_count FROM dw.fact_tenant_snapshot WHERE tenant_id = ${tenantA}::uuid`).toEqual([{ testimonial_count: 0n }]);
  });
});
