import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { ConsoleLogger } from '@nestjs/common';
import { SourceRepository } from '../src/modules/business-intelligence/repositories/source.repository';
import { WarehouseRepository } from '../src/modules/business-intelligence/repositories/warehouse.repository';
import { applyWarehouseMigration, migrationStatements } from '../src/modules/business-intelligence/repositories/warehouse-migrations';
import { EtlService } from '../src/modules/business-intelligence/services/etl.service';
import { hourUtc, type Lease, type SourceSnapshot } from '../src/modules/business-intelligence/etl.types';
import { AnalyticsRepository } from '../src/modules/analytics/repositories/analytics.repository';
import { TestimonialRepository } from '../src/modules/testimonials/repositories/testimonial.repository';
import { PrismaService } from '../src/modules/database/prisma.service';
import { main as etlMain } from '../src/modules/business-intelligence/etl.cli';

// Explicit opt-in to TWO disposable servers. Create and remove fresh databases and restricted roles.
const sourceAdminUrl = process.env.TEST_BI_SOURCE_DATABASE_URL;
const targetAdminUrl = process.env.TEST_BI_WAREHOUSE_DATABASE_URL;
const databaseTests = sourceAdminUrl && targetAdminUrl ? describe : describe.skip;

databaseTests('hourly ETL with two PostgreSQL servers and restricted identities', () => {
  jest.setTimeout(30000);
  const suffix = randomUUID().replaceAll('-', '');
  const sourceDb = `bi_source_${suffix}`;
  const targetDb = `bi_dw_${suffix}`;
  const sourceRole = `bi_extract_${suffix}`;
  const writerRole = `bi_writer_${suffix}`;
  const readerRole = `bi_reader_${suffix}`;
  let parentSource: PrismaClient;
  let parentTarget: PrismaClient;
  let sourceAdmin: PrismaClient;
  let targetAdmin: PrismaClient;
  let source: PrismaClient;
  let target: PrismaClient;
  let reader: PrismaClient;
  let sourceRepo: SourceRepository;
  let warehouse: WarehouseRepository;
  let service: EtlService;
  let warehouseSql: string;
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const categoryA = randomUUID();
  const categoryB = randomUUID();
  const testimonialA = randomUUID();
  const testimonialA2 = randomUUID();
  const testimonialB = randomUUID();
  const bigEventId = 9007199254740993n;

  function client(url: string, db: string, user?: string, limit = 2) {
    const parsed = new URL(url); parsed.pathname = `/${db}`;
    if (user) { parsed.username = user; parsed.password = ''; }
    parsed.searchParams.set('connection_limit', String(limit));
    return new PrismaClient({ datasources: { db: { url: parsed.toString() } }, log: [] });
  }

  beforeAll(async () => {
    parentSource = new PrismaClient({ datasources: { db: { url: sourceAdminUrl! } } });
    parentTarget = new PrismaClient({ datasources: { db: { url: targetAdminUrl! } } });
    await parentSource.$executeRawUnsafe(`CREATE DATABASE "${sourceDb}"`);
    await parentTarget.$executeRawUnsafe(`CREATE DATABASE "${targetDb}"`);
    sourceAdmin = client(sourceAdminUrl!, sourceDb);
    targetAdmin = client(targetAdminUrl!, targetDb);
    // Fixed repository fixtures, no caller-controlled filename.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const fixture = readFileSync(join(__dirname, 'fixtures/bi-source.sql'), 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const sourceViews = readFileSync(join(__dirname, '../prisma/migrations/20261008010000_bi_export_views/migration.sql'), 'utf8');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    warehouseSql = readFileSync(join(__dirname, '../warehouse/migrations/0001_initial.sql'), 'utf8');
    await sourceAdmin.$transaction(async tx => {
      for (const sql of [...migrationStatements(fixture), ...migrationStatements(sourceViews)]) await tx.$executeRawUnsafe(sql);
    }, { timeout: 20000 });
    await applyWarehouseMigration(targetAdmin, '0001_initial.sql', warehouseSql);
    await parentSource.$executeRawUnsafe(`CREATE ROLE "${sourceRole}" LOGIN`);
    await parentTarget.$executeRawUnsafe(`CREATE ROLE "${writerRole}" LOGIN`);
    await parentTarget.$executeRawUnsafe(`CREATE ROLE "${readerRole}" LOGIN`);
    await sourceAdmin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA bi_export TO "${sourceRole}"`);
    await sourceAdmin.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA bi_export TO "${sourceRole}"`);
    await targetAdmin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA staging, dw, etl TO "${writerRole}"`);
    await targetAdmin.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA staging, dw, etl TO "${writerRole}"`);
    await targetAdmin.$executeRawUnsafe(`REVOKE ALL ON etl.schema_migrations FROM "${writerRole}"`);
    await targetAdmin.$executeRawUnsafe(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA dw, etl TO "${writerRole}"`);
    await targetAdmin.$executeRawUnsafe(`GRANT USAGE ON SCHEMA dw, etl TO "${readerRole}"`);
    await targetAdmin.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA dw TO "${readerRole}"`);
    await targetAdmin.$executeRawUnsafe(`GRANT SELECT ON etl.runs, etl.tenant_load_state TO "${readerRole}"`);
    source = client(sourceAdminUrl!, sourceDb, sourceRole, 1);
    target = client(targetAdminUrl!, targetDb, writerRole, 2);
    reader = client(targetAdminUrl!, targetDb, readerRole, 1);
    sourceRepo = new SourceRepository(source, 1); // Force multiple pages, including IDs above Number.MAX_SAFE_INTEGER.
    warehouse = new WarehouseRepository(target);
    service = new EtlService(sourceRepo, warehouse);
  });

  beforeEach(async () => {
    await targetAdmin.$executeRawUnsafe(`TRUNCATE etl.tenant_load_state, etl.runs, dw.dim_tenant,
      dw.dim_date, dw.dim_status, dw.dim_event_type RESTART IDENTITY CASCADE`);
    await sourceAdmin.$executeRawUnsafe('TRUNCATE tenants, feature_flags CASCADE');
    await sourceAdmin.$executeRaw`INSERT INTO tenants (id, name, is_active)
      VALUES (${tenantA}::uuid, 'Synthetic A', true), (${tenantB}::uuid, 'Synthetic B', false)`;
    await sourceAdmin.$executeRaw`INSERT INTO categories (id, tenant_id, name)
      VALUES (${categoryA}::uuid, ${tenantA}::uuid, 'Category A'), (${categoryB}::uuid, ${tenantB}::uuid, 'Category B')`;
    await sourceAdmin.$executeRaw`INSERT INTO testimonials (id, tenant_id, category_id, status_id, rating, score, published_at, image_url)
      VALUES (${testimonialA}::uuid, ${tenantA}::uuid, ${categoryA}::uuid, 1, 5, 50.1234, '2024-01-02Z', 'synthetic-private-image'),
        (${testimonialA2}::uuid, ${tenantA}::uuid, NULL, 2, 4, 0, NULL, NULL),
        (${testimonialB}::uuid, ${tenantB}::uuid, ${categoryB}::uuid, 1, 3, 30, '2024-01-02Z', NULL)`;
    await sourceAdmin.$executeRaw`INSERT INTO analytics_events (id, tenant_id, testimonial_id, event_type_id, source, created_at)
      VALUES (1, ${tenantA}::uuid, ${testimonialA}::uuid, 1, 'widget', '2024-02-29T23:59:59.999Z'),
        (${bigEventId}, ${tenantA}::uuid, ${testimonialA}::uuid, 2, 'synthetic-private-custom-source', '2024-03-01T00:00:00Z'),
        (${bigEventId + 1n}, ${tenantA}::uuid, ${testimonialA}::uuid, 3, 'public-browser', '2024-03-01T00:00:00Z'),
        (3, ${tenantB}::uuid, ${testimonialB}::uuid, 1, 'api', '2024-03-01T00:00:00Z')`;
  });

  afterAll(async () => {
    await Promise.allSettled([source, target, reader, sourceAdmin, targetAdmin].filter(Boolean).map(c => c.$disconnect()));
    if (parentSource) {
      await parentSource.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${sourceDb}" WITH (FORCE)`);
      await parentSource.$executeRawUnsafe(`DROP ROLE IF EXISTS "${sourceRole}"`);
      await parentSource.$disconnect();
    }
    if (parentTarget) {
      await parentTarget.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${targetDb}" WITH (FORCE)`);
      await parentTarget.$executeRawUnsafe(`DROP ROLE IF EXISTS "${writerRole}"`);
      await parentTarget.$executeRawUnsafe(`DROP ROLE IF EXISTS "${readerRole}"`);
      await parentTarget.$disconnect();
    }
  });

  async function current(tenantId = tenantA) {
    const [state] = await targetAdmin.$queryRaw<Array<{ runId: string | null }>>`
      SELECT last_published_run_id AS "runId" FROM etl.tenant_load_state WHERE tenant_id = ${tenantId}::uuid`;
    return state?.runId;
  }
  async function movePreviousCutBack(hours = 3) {
    // Simulated passage of hours, confined to the disposable fixture; real runtime never backdates cuts.
    await targetAdmin.$executeRaw`UPDATE etl.runs SET slot_at = slot_at - ${hours} * interval '1 hour',
      source_snapshot_at = source_snapshot_at - ${hours} * interval '1 hour' WHERE tenant_id = ${tenantA}::uuid AND status = 'succeeded'`;
  }
  async function prepare(lease?: Lease) {
    const active = lease ?? await warehouse.claim(tenantA, hourUtc(new Date()));
    if (!active) throw new Error('Expected a lease');
    let snapshot: SourceSnapshot | undefined;
    const counts = await sourceRepo.extract(tenantA, {
      snapshot: async value => { snapshot = value; await warehouse.snapshot(active, value); },
      categories: rows => warehouse.categories(active, rows),
      testimonials: rows => warehouse.testimonials(active, rows),
      events: rows => warehouse.events(active, rows),
    });
    if (!snapshot) throw new Error('Expected snapshot');
    return { lease: active, snapshot, counts };
  }

  it('reconciles both companies, inactive tenants, BigInt events, UTC dates and safe source codes', async () => {
    const results = [];
    for await (const result of service.cycle()) results.push(result);
    expect(results).toHaveLength(2);
    expect(results.every(result => result.status === 'succeeded')).toBe(true);
    const [run] = await targetAdmin.$queryRaw<Array<{ events: bigint; testimonials: bigint }>>`
      SELECT source_event_count AS events, source_testimonial_count AS testimonials FROM etl.runs
      WHERE tenant_id = ${tenantA}::uuid AND status = 'succeeded'`;
    expect(run).toEqual({ events: 3n, testimonials: 2n });
    const facts = await reader.$queryRaw<Array<{ date: string; count: bigint; code: string }>>`
      SELECT f.date_key::text AS date, f.event_count AS count, s.code FROM dw.fact_engagement_daily f
      JOIN dw.dim_source s ON s.tenant_id = f.tenant_id AND s.source_key = f.source_key
      WHERE f.tenant_id = ${tenantA}::uuid ORDER BY date, code`;
    expect(facts).toEqual([{ date: '2024-02-29', count: 1n, code: 'widget' },
      { date: '2024-03-01', count: 1n, code: 'other' }, { date: '2024-03-01', count: 1n, code: 'public-browser' }]);
    expect(await targetAdmin.$queryRaw`SELECT is_active FROM dw.dim_tenant WHERE tenant_id = ${tenantB}::uuid`)
      .toEqual([{ is_active: false }]);
    expect(await targetAdmin.$queryRaw`SELECT score::text, has_image FROM dw.fact_testimonial_snapshot
      WHERE tenant_id = ${tenantA}::uuid AND testimonial_id = ${testimonialA}::uuid`)
      .toEqual([{ score: '50.1234', has_image: true }]);
    expect(await targetAdmin.$queryRaw`SELECT count(*) AS count FROM staging.analytics_events`).toEqual([{ count: 0n }]);
  });

  it('skips duplicate successful slots and publishes an empty company with a durable pointer', async () => {
    expect((await service.runTenant(tenantA)).status).toBe('succeeded');
    expect((await service.runTenant(tenantA)).status).toBe('skipped');
    expect(await targetAdmin.$queryRaw`SELECT count(*) AS count FROM etl.runs WHERE tenant_id = ${tenantA}::uuid`).toEqual([{ count: 1n }]);
    const empty = randomUUID();
    await sourceAdmin.$executeRaw`INSERT INTO tenants (id, name) VALUES (${empty}::uuid, 'Synthetic empty')`;
    expect((await service.runTenant(empty)).status).toBe('succeeded');
    expect(await current(empty)).toEqual(expect.any(String));
    expect(await targetAdmin.$queryRaw`SELECT source_event_count, snapshot_row_count FROM etl.runs WHERE tenant_id = ${empty}::uuid`)
      .toEqual([{ source_event_count: 0n, snapshot_row_count: 0n }]);
  });

  it('runs the standalone once entry with only source and warehouse configuration', async () => {
    const previousSource = process.env.BI_SOURCE_DATABASE_URL;
    const previousTarget = process.env.BI_ETL_DATABASE_URL;
    const logs = jest.spyOn(ConsoleLogger.prototype, 'log').mockImplementation(() => undefined);
    const sourceUrl = new URL(sourceAdminUrl!); sourceUrl.pathname = `/${sourceDb}`; sourceUrl.username = sourceRole; sourceUrl.password = '';
    const targetUrl = new URL(targetAdminUrl!); targetUrl.pathname = `/${targetDb}`; targetUrl.username = writerRole; targetUrl.password = '';
    try {
      process.env.BI_SOURCE_DATABASE_URL = sourceUrl.toString();
      process.env.BI_ETL_DATABASE_URL = targetUrl.toString();
      await etlMain(['--once']);
      expect(await current(tenantA)).toEqual(expect.any(String));
      expect(await current(tenantB)).toEqual(expect.any(String));
      expect(logs).toHaveBeenCalledWith(expect.objectContaining({ event: 'bi.etl_cycle_finished', failed: false }));
      expect(JSON.stringify(logs.mock.calls)).not.toContain(sourceRole);
    } finally {
      if (previousSource === undefined) delete process.env.BI_SOURCE_DATABASE_URL;
      else process.env.BI_SOURCE_DATABASE_URL = previousSource;
      if (previousTarget === undefined) delete process.env.BI_ETL_DATABASE_URL;
      else process.env.BI_ETL_DATABASE_URL = previousTarget;
      logs.mockRestore();
    }
  });

  it('keeps one consistent source snapshot during concurrent writes between pages', async () => {
    let mutated = false;
    class MutatingWarehouse extends WarehouseRepository {
      override async categories(lease: Lease, rows: Parameters<WarehouseRepository['categories']>[1]) {
        await super.categories(lease, rows);
        if (mutated) return;
        mutated = true;
        await sourceAdmin.$executeRaw`UPDATE tenants SET name = 'Changed during extraction' WHERE id = ${tenantA}::uuid`;
        await sourceAdmin.$executeRaw`UPDATE testimonials SET rating = 1 WHERE tenant_id = ${tenantA}::uuid AND id = ${testimonialA2}::uuid`;
        await sourceAdmin.$executeRaw`INSERT INTO analytics_events (id, tenant_id, testimonial_id, event_type_id)
          VALUES (999999999, ${tenantA}::uuid, ${testimonialA}::uuid, 1)`;
      }
    }
    const result = await new EtlService(sourceRepo, new MutatingWarehouse(target)).runTenant(tenantA);
    expect(result.status).toBe('succeeded');
    expect(await targetAdmin.$queryRaw`SELECT name FROM dw.dim_tenant WHERE tenant_id = ${tenantA}::uuid`).toEqual([{ name: 'Synthetic A' }]);
    expect(await targetAdmin.$queryRaw`SELECT rating FROM dw.fact_testimonial_snapshot
      WHERE tenant_id = ${tenantA}::uuid AND testimonial_id = ${testimonialA2}::uuid`).toEqual([{ rating: 4 }]);
    expect(await targetAdmin.$queryRaw`SELECT source_event_count FROM etl.runs WHERE tenant_id = ${tenantA}::uuid`).toEqual([{ source_event_count: 3n }]);
  });

  it('reconciles changes and deletions while preserving previous snapshots and leaving missed hours absent', async () => {
    await service.runTenant(tenantA);
    const previous = await current();
    await movePreviousCutBack();
    await sourceAdmin.$executeRaw`UPDATE categories SET name = 'Renamed' WHERE tenant_id = ${tenantA}::uuid AND id = ${categoryA}::uuid`;
    await sourceAdmin.$executeRaw`DELETE FROM testimonials WHERE tenant_id = ${tenantA}::uuid AND id = ${testimonialA2}::uuid`;
    await sourceAdmin.$executeRaw`DELETE FROM analytics_events WHERE tenant_id = ${tenantA}::uuid AND event_type_id = 2`;
    await service.runTenant(tenantA);
    const latest = await current();
    expect(latest).not.toBe(previous);
    expect(await targetAdmin.$queryRaw`SELECT count(*) AS count FROM dw.fact_testimonial_snapshot WHERE tenant_id = ${tenantA}::uuid AND run_id = ${previous}::uuid`)
      .toEqual([{ count: 2n }]);
    expect(await targetAdmin.$queryRaw`SELECT count(*) AS count FROM dw.fact_testimonial_snapshot WHERE tenant_id = ${tenantA}::uuid AND run_id = ${latest}::uuid`)
      .toEqual([{ count: 1n }]);
    expect(await targetAdmin.$queryRaw`SELECT is_present FROM dw.dim_testimonial WHERE tenant_id = ${tenantA}::uuid AND testimonial_id = ${testimonialA2}::uuid`)
      .toEqual([{ is_present: false }]);
    expect(await targetAdmin.$queryRaw`SELECT name FROM dw.dim_category WHERE tenant_id = ${tenantA}::uuid AND source_category_id = ${categoryA}::uuid`)
      .toEqual([{ name: 'Renamed' }]);
    expect(await targetAdmin.$queryRaw`SELECT sum(event_count)::text AS count FROM dw.fact_engagement_daily WHERE tenant_id = ${tenantA}::uuid`)
      .toEqual([{ count: '2' }]);
    const [count] = await targetAdmin.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM etl.runs WHERE tenant_id = ${tenantA}::uuid AND status = 'succeeded'`;
    expect(count?.count).toBe(2n);
  });

  it('rolls back all publication changes on failure and keeps the previous correct result', async () => {
    await service.runTenant(tenantA);
    const previous = await current();
    await movePreviousCutBack();
    await sourceAdmin.$executeRaw`UPDATE tenants SET name = 'Should roll back' WHERE id = ${tenantA}::uuid`;
    await targetAdmin.$executeRawUnsafe(`CREATE FUNCTION dw.synthetic_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'synthetic failure'; END $$`);
    await targetAdmin.$executeRawUnsafe('CREATE TRIGGER synthetic_failure BEFORE INSERT ON dw.fact_engagement_daily FOR EACH ROW EXECUTE FUNCTION dw.synthetic_failure()');
    try {
      expect((await service.runTenant(tenantA)).status).toBe('failed');
      expect(await current()).toBe(previous);
      expect(await targetAdmin.$queryRaw`SELECT name FROM dw.dim_tenant WHERE tenant_id = ${tenantA}::uuid`).toEqual([{ name: 'Synthetic A' }]);
      expect(await targetAdmin.$queryRaw`SELECT count(*) AS count FROM dw.fact_testimonial_snapshot WHERE tenant_id = ${tenantA}::uuid`)
        .toEqual([{ count: 2n }]);
      expect(await targetAdmin.$queryRaw`SELECT count(*) AS count FROM etl.runs WHERE tenant_id = ${tenantA}::uuid AND status = 'failed'`)
        .toEqual([{ count: 3n }]);
      expect(await targetAdmin.$queryRaw`SELECT source_event_count, snapshot_row_count FROM etl.runs
        WHERE tenant_id = ${tenantA}::uuid AND status = 'failed' ORDER BY attempt_no`)
        .toEqual(Array.from({ length: 3 }, () => ({ source_event_count: 3n, snapshot_row_count: 0n })));
      expect(await warehouse.claim(tenantA, hourUtc(new Date()))).toBeNull();
    } finally { await targetAdmin.$executeRawUnsafe('DROP TRIGGER synthetic_failure ON dw.fact_engagement_daily'); }
  });

  it('rolls back a publication whose lease expires during the final writes', async () => {
    const data = await prepare();
    await targetAdmin.$executeRawUnsafe(`CREATE FUNCTION dw.synthetic_slow_publish() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_sleep(0.5); RETURN NEW; END $$`);
    await targetAdmin.$executeRawUnsafe('CREATE TRIGGER synthetic_slow_publish BEFORE INSERT ON dw.fact_testimonial_snapshot FOR EACH ROW EXECUTE FUNCTION dw.synthetic_slow_publish()');
    try {
      await targetAdmin.$executeRaw`UPDATE etl.tenant_load_state SET lease_until = clock_timestamp() + interval '400 milliseconds'
        WHERE tenant_id = ${tenantA}::uuid`;
      await expect(warehouse.publish(data.lease, data.snapshot, data.counts)).rejects.toMatchObject({ code: 'BI_LEASE_LOST' });
      expect(await current()).toBeNull();
      expect(await targetAdmin.$queryRaw`SELECT count(*) AS count FROM dw.fact_testimonial_snapshot WHERE tenant_id = ${tenantA}::uuid`)
        .toEqual([{ count: 0n }]);
      expect(await warehouse.status(data.lease)).toBe('running');
    } finally { await targetAdmin.$executeRawUnsafe('DROP TRIGGER synthetic_slow_publish ON dw.fact_testimonial_snapshot'); }
  });

  it('resolves a connection failure after the actual commit without duplicating facts', async () => {
    class AmbiguousWarehouse extends WarehouseRepository {
      override async publish(...args: Parameters<WarehouseRepository['publish']>) {
        await super.publish(...args);
        throw new Error('synthetic connection loss after commit');
      }
    }
    const result = await new EtlService(sourceRepo, new AmbiguousWarehouse(target)).runTenant(tenantA);
    expect(result.status).toBe('succeeded');
    expect(await current()).toBe(result.runId);
    expect(await targetAdmin.$queryRaw`SELECT count(*) AS count FROM etl.runs WHERE tenant_id = ${tenantA}::uuid`)
      .toEqual([{ count: 1n }]);
    expect(await targetAdmin.$queryRaw`SELECT count(*) AS count FROM dw.fact_testimonial_snapshot WHERE tenant_id = ${tenantA}::uuid`)
      .toEqual([{ count: 2n }]);
  });

  it('recovers an abandoned upload and fences every write and release from the old worker', async () => {
    const first = await prepare();
    await targetAdmin.$executeRaw`UPDATE etl.tenant_load_state SET lease_until = '2000-01-01Z' WHERE tenant_id = ${tenantA}::uuid`;
    expect(await warehouse.heartbeat(first.lease)).toBe(false);
    const second = await warehouse.claim(tenantA, first.lease.slot);
    expect(second).not.toBeNull();
    expect(await warehouse.status(first.lease)).toBe('abandoned');
    await expect(warehouse.publish(first.lease, first.snapshot, first.counts)).rejects.toMatchObject({ code: 'BI_LEASE_LOST' });
    await expect(warehouse.categories(first.lease, [{ tenantId: tenantA, categoryId: randomUUID(), name: 'stale' }])).rejects.toMatchObject({ code: 'BI_LEASE_LOST' });
    await warehouse.fail(first.lease, 'BI_ETL_FAILED');
    expect(await warehouse.heartbeat(second!)).toBe(true);
    expect(await targetAdmin.$queryRaw`SELECT count(*) AS count FROM staging.testimonials WHERE tenant_id = ${tenantA}::uuid`).toEqual([{ count: 0n }]);
  });

  it('cannot claim the same tenant concurrently and cannot publish across tenant boundaries', async () => {
    const claims = await Promise.all([warehouse.claim(tenantA, hourUtc(new Date())), warehouse.claim(tenantA, hourUtc(new Date()))]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    const lease = claims.find(Boolean)!;
    await expect(warehouse.categories(lease, [{ tenantId: tenantB, categoryId: categoryB, name: 'foreign' }])).rejects.toMatchObject({ code: 'BI_SOURCE_INCONSISTENT' });
    await expect(targetAdmin.$executeRaw`INSERT INTO staging.categories (tenant_id, run_id, category_id, name)
      VALUES (${tenantB}::uuid, ${lease.runId}::uuid, ${categoryB}::uuid, 'foreign')`).rejects.toThrow();
    const data = await prepare(lease);
    await targetAdmin.$executeRaw`UPDATE etl.tenant_load_state SET lease_until = clock_timestamp() + interval '1 millisecond' WHERE tenant_id = ${tenantA}::uuid`;
    await expect(warehouse.publish(lease, data.snapshot, data.counts)).rejects.toMatchObject({ code: 'BI_LEASE_LOST' });
    expect(await current()).toBeNull();
  });

  it('rejects duplicate staging rows, missing references, future data and wrong reconciliation counts', async () => {
    const data = await prepare();
    await expect(warehouse.categories(data.lease, [{ tenantId: tenantA, categoryId: categoryA, name: 'duplicate' }]))
      .rejects.toMatchObject({ code: 'BI_SOURCE_INCONSISTENT' });
    await expect(warehouse.events(data.lease, [{ tenantId: tenantA, eventId: 100n, testimonialId: randomUUID(),
      eventTypeCode: 'view', sourceCode: 'public', createdAt: new Date('2024-01-01Z') }])).rejects.toMatchObject({ code: 'BI_SOURCE_INCONSISTENT' });
    await expect(warehouse.publish(data.lease, data.snapshot, { ...data.counts, events: 9n })).rejects.toMatchObject({ code: 'BI_SOURCE_INCONSISTENT' });
    await targetAdmin.$executeRaw`UPDATE staging.analytics_events SET created_at = ${new Date(data.snapshot.at.getTime() + 1)}
      WHERE tenant_id = ${tenantA}::uuid AND run_id = ${data.lease.runId}::uuid`;
    await expect(warehouse.publish(data.lease, data.snapshot, data.counts)).rejects.toMatchObject({ code: 'BI_SOURCE_INCONSISTENT' });
    expect(await current()).toBeNull();
  });

  it('prevents pointer regression and stops publication after its absolute deadline', async () => {
    await service.runTenant(tenantA);
    const previous = await current();
    // The current slot already succeeded; reserve an earlier slot solely to exercise monotonicity.
    const lease = await warehouse.claim(tenantA, new Date(hourUtc(new Date()).getTime() - 3600000));
    if (!lease) throw new Error('Expected earlier lease');
    const snapshot = { tenantId: tenantA, name: 'earlier', isActive: true, at: new Date(lease.slot.getTime() + 1) };
    await warehouse.snapshot(lease, snapshot);
    await expect(warehouse.publish(lease, snapshot, { categories: 0n, testimonials: 0n, events: 0n }))
      .rejects.toMatchObject({ code: 'BI_SOURCE_NOT_NEWER' });
    await expect(warehouse.publish({ ...lease, deadline: Date.now() - 1 }, snapshot, { categories: 0n, testimonials: 0n, events: 0n }))
      .rejects.toMatchObject({ code: 'BI_DEADLINE_EXCEEDED' });
    expect(await current()).toBe(previous);
  });

  it('enforces extraction, writer, reader and migration privileges and detects checksum drift', async () => {
    await expect(source.$queryRaw`SELECT content, author_name, image_url FROM public.testimonials`).rejects.toThrow();
    await expect(source.$executeRaw`UPDATE bi_export.tenants SET name = 'forbidden' WHERE tenant_id = ${tenantA}::uuid`).rejects.toThrow();
    await expect(target.$executeRawUnsafe('CREATE TABLE dw.forbidden (id integer)')).rejects.toThrow();
    await expect(target.$executeRaw`UPDATE etl.schema_migrations SET checksum = ${'0'.repeat(64)}`).rejects.toThrow();
    await expect(reader.$queryRaw`SELECT * FROM staging.testimonials`).rejects.toThrow();
    await expect(reader.$executeRaw`DELETE FROM dw.dim_tenant WHERE tenant_id = ${tenantA}::uuid`).rejects.toThrow();
    expect(await applyWarehouseMigration(targetAdmin, '0001_initial.sql', warehouseSql)).toBe(false);
    await expect(applyWarehouseMigration(targetAdmin, '0001_initial.sql', warehouseSql + '\n-- altered'))
      .rejects.toMatchObject({ code: 'BI_MIGRATION_DRIFT' });
  });

  it('isolates engagement and scoring writes even when supplied foreign IDs or changed moderation state', async () => {
    const flag = randomUUID();
    await sourceAdmin.$executeRaw`INSERT INTO feature_flags (id, name) VALUES (${flag}::uuid, 'enable_scoring')`;
    await sourceAdmin.$executeRaw`INSERT INTO tenant_feature_flags (tenant_id, feature_flag_id) VALUES (${tenantA}::uuid, ${flag}::uuid)`;
    const database = Object.assign(sourceAdmin, { withRetry: sourceAdmin.$transaction.bind(sourceAdmin) }) as unknown as PrismaService;
    const scoring = new TestimonialRepository(database);
    const engagement = new AnalyticsRepository(database);
    expect(await scoring.findScoringTenantIds()).toEqual([tenantA]);
    expect(await scoring.findPublishedForScoring(tenantA)).toEqual([{ id: testimonialA, rating: 5, publishedAt: expect.any(Date) }]);
    expect(await scoring.findPublishedForScoring(tenantB)).toEqual([]);
    const metrics = await engagement.getEngagementCounts(tenantA, [testimonialA, testimonialB]);
    expect(metrics.get(testimonialA)).toEqual({ views: 1, clicks: 1 });
    expect(metrics.get(testimonialB)).toEqual({ views: 0, clicks: 0 });
    await scoring.updateScores(tenantA, [{ id: testimonialA, score: 77 }, { id: testimonialB, score: 999 }, { id: testimonialA2, score: 999 }]);
    const [foreign] = await sourceAdmin.$queryRaw<Array<{ score: { toString(): string } }>>`SELECT score FROM testimonials WHERE tenant_id = ${tenantB}::uuid AND id = ${testimonialB}::uuid`;
    expect(foreign?.score.toString()).toBe('30');
    await sourceAdmin.$executeRaw`UPDATE testimonials SET status_id = 2 WHERE tenant_id = ${tenantA}::uuid AND id = ${testimonialA}::uuid`;
    await scoring.updateScores(tenantA, [{ id: testimonialA, score: 99 }]);
    const [own] = await sourceAdmin.$queryRaw<Array<{ score: { toString(): string } }>>`SELECT score FROM testimonials WHERE tenant_id = ${tenantA}::uuid AND id = ${testimonialA}::uuid`;
    expect(own?.score.toString()).toBe('77');
  });
});
