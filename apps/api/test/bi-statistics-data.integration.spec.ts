import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { SourceRepository } from '../src/modules/business-intelligence/repositories/source.repository';
import { WarehouseRepository } from '../src/modules/business-intelligence/repositories/warehouse.repository';
import { StatisticsHistoryRepository } from '../src/modules/business-intelligence/repositories/statistics-history.repository';
import { statisticsDataReady } from '../src/modules/business-intelligence/repositories/statistics-data-preflight';
import { applyWarehouseMigration, migrationStatements } from '../src/modules/business-intelligence/repositories/warehouse-migrations';
import { hourUtc, type Lease, type SourceConsumer, type SourceSnapshot } from '../src/modules/business-intelligence/etl.types';
import { installBiWarehouse } from './fixtures/bi-warehouse';
import { main as worker } from '../src/modules/business-intelligence/etl.cli';
import { ConsoleLogger } from '@nestjs/common';

const sourceUrl = process.env.TEST_BI_SOURCE_DATABASE_URL;
const targetUrl = process.env.TEST_BI_WAREHOUSE_DATABASE_URL;
const databaseTests = sourceUrl && targetUrl ? describe : describe.skip;

databaseTests('statistics data on two disposable PostgreSQL 18 servers', () => {
  jest.setTimeout(30000);
  const suffix = randomUUID().replaceAll('-', '');
  const sourceDb = `stats_source_${suffix}`; const targetDb = `stats_dw_${suffix}`;
  const extractor = `stats_extract_${suffix}`; const writer = `stats_writer_${suffix}`; const reader = `stats_reader_${suffix}`;
  const tenant = randomUUID(); const other = randomUUID();
  const testimonial = randomUUID(); const second = randomUUID(); const foreign = randomUUID();
  const tag = randomUUID(); const tag2 = randomUUID(); const foreignTag = randomUUID();
  let sourceParent: PrismaClient; let targetParent: PrismaClient;
  let source: PrismaClient; let target: PrismaClient; let sourceRead: PrismaClient; let targetWrite: PrismaClient; let targetRead: PrismaClient;
  let history: StatisticsHistoryRepository;
  // Fixed repository paths, never inputs from HTTP/CLI.
  const sql = (name: string) => {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    return readFileSync(join(__dirname, name), 'utf8');
  };
  const migration = sql('../warehouse/migrations/0005_bi_statistics.sql');
  const apply = () => applyWarehouseMigration(target, '0005_bi_statistics.sql', migration);
  function client(base: string, database: string, role?: string) {
    const url = new URL(base); url.pathname = `/${database}`; url.searchParams.set('connection_limit', '2');
    if (role) { url.username = role; url.password = ''; }
    return new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] });
  }
  beforeAll(async () => {
    sourceParent = new PrismaClient({ datasources: { db: { url: sourceUrl! } } });
    targetParent = new PrismaClient({ datasources: { db: { url: targetUrl! } } });
    await sourceParent.$executeRawUnsafe(`CREATE DATABASE "${sourceDb}"`);
    await targetParent.$executeRawUnsafe(`CREATE DATABASE "${targetDb}"`);
    await sourceParent.$executeRawUnsafe(`CREATE ROLE "${extractor}" LOGIN`);
    await targetParent.$executeRawUnsafe(`CREATE ROLE "${writer}" LOGIN`);
    await targetParent.$executeRawUnsafe(`CREATE ROLE "${reader}" LOGIN`);
    source = client(sourceUrl!, sourceDb); target = client(targetUrl!, targetDb);
    sourceRead = client(sourceUrl!, sourceDb, extractor); targetWrite = client(targetUrl!, targetDb, writer); targetRead = client(targetUrl!, targetDb, reader);
    for (const name of ['fixtures/bi-source.sql', 'fixtures/bi-statistics-source.sql',
      '../prisma/migrations/20261008010000_bi_export_views/migration.sql', '../prisma/migrations/20261019000000_bi_statistics_export/migration.sql']) {
      for (const statement of migrationStatements(sql(name))) await source.$executeRawUnsafe(statement);
    }
    await source.$executeRawUnsafe(`GRANT USAGE ON SCHEMA bi_export TO "${extractor}"`);
    await source.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA bi_export TO "${extractor}"`);
    history = new StatisticsHistoryRepository(target, 1);
  });
  beforeEach(async () => {
    await target.$executeRawUnsafe('DROP SCHEMA IF EXISTS staging, dw, etl CASCADE');
    await installBiWarehouse(target);
    await applyWarehouseMigration(target, '0004_bi_operations.sql', sql('../warehouse/migrations/0004_bi_operations.sql'));
    await source.$executeRawUnsafe('TRUNCATE tenants CASCADE');
    await source.$executeRaw`INSERT INTO tenants (id, name) VALUES (${tenant}::uuid, 'Synthetic A'), (${other}::uuid, 'Synthetic B')`;
    await source.$executeRaw`INSERT INTO testimonials (id, tenant_id, status_id, rating) VALUES
      (${testimonial}::uuid, ${tenant}::uuid, 1, 5), (${second}::uuid, ${tenant}::uuid, 2, 2), (${foreign}::uuid, ${other}::uuid, 1, 1)`;
    await source.$executeRaw`INSERT INTO tags (id, tenant_id, name) VALUES
      (${tag}::uuid, ${tenant}::uuid, 'Synthetic service'), (${tag2}::uuid, ${tenant}::uuid, 'Synthetic speed'),
      (${foreignTag}::uuid, ${other}::uuid, 'Synthetic foreign')`;
    await source.$executeRaw`INSERT INTO testimonial_tags (tenant_id, testimonial_id, tag_id) VALUES
      (${tenant}::uuid, ${testimonial}::uuid, ${tag}::uuid), (${tenant}::uuid, ${testimonial}::uuid, ${tag2}::uuid),
      (${tenant}::uuid, ${second}::uuid, ${tag}::uuid), (${other}::uuid, ${foreign}::uuid, ${foreignTag}::uuid)`;
  });
  afterAll(async () => {
    await Promise.all([source?.$disconnect(), target?.$disconnect(), sourceRead?.$disconnect(), targetWrite?.$disconnect(), targetRead?.$disconnect()]);
    if (sourceParent) {
      await sourceParent.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${sourceDb}" WITH (FORCE)`);
      await sourceParent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${extractor}"`); await sourceParent.$disconnect();
    }
    if (targetParent) {
      await targetParent.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${targetDb}" WITH (FORCE)`);
      await targetParent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${writer}", "${reader}"`); await targetParent.$disconnect();
    }
  });
  async function grants() {
    await target.$executeRawUnsafe(`GRANT USAGE ON SCHEMA staging, dw, etl TO "${writer}"`);
    await target.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA staging TO "${writer}"`);
    await target.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON dw.dim_date, dw.dim_tenant, dw.dim_testimonial,
      dw.dim_category, dw.dim_status, dw.dim_source, dw.dim_event_type, dw.fact_tenant_snapshot,
      dw.fact_testimonial_snapshot, dw.fact_engagement_daily TO "${writer}"`);
    await target.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE ON etl.runs, etl.tenant_load_state,
      dw.dim_tag, dw.statistics_history_state TO "${writer}"`);
    await target.$executeRawUnsafe(`GRANT SELECT, INSERT ON dw.fact_tag_snapshot, dw.bridge_testimonial_tag_snapshot,
      dw.fact_testimonial_creation, dw.statistics_publication TO "${writer}"`);
    await target.$executeRawUnsafe(`GRANT SELECT ON etl.schema_migrations TO "${writer}"`);
    await target.$executeRawUnsafe(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA dw, etl TO "${writer}"`);
    await target.$executeRawUnsafe(`GRANT USAGE ON SCHEMA dw TO "${reader}"`);
    await target.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA dw TO "${reader}"`);
  }
  async function load(at: string, statistics = true, tenantId = tenant, useWriter = false, override?: WarehouseRepository) {
    const warehouse = override ?? new WarehouseRepository(useWriter ? targetWrite : target, statistics);
    const lease = await warehouse.claim(tenantId, hourUtc(new Date(at)));
    if (!lease) throw new Error('Synthetic load could not claim');
    let cut: SourceSnapshot = { tenantId, name: 'Synthetic', isActive: true, at: new Date(at) };
    const consumer: SourceConsumer = { snapshot: async value => { cut = { ...value, at: new Date(at) }; await warehouse.snapshot(lease, cut); },
      categories: rows => warehouse.categories(lease, rows), testimonials: rows => warehouse.testimonials(lease, rows),
      events: rows => warehouse.events(lease, rows), tags: rows => warehouse.tags(lease, rows),
      testimonialTags: rows => warehouse.testimonialTags(lease, rows) };
    try {
      const counts = await new SourceRepository(sourceRead, 1, statistics).extract(tenantId, consumer);
      await warehouse.extracted(lease, counts); await warehouse.publish(lease, cut, counts);
      return { lease, counts };
    } catch (error) { await warehouse.fail(lease, 'BI_SOURCE_INCONSISTENT'); throw error; }
  }

  it('requires 0004 and preserves applied migration checksums across repeat and drift', async () => {
    const previous = await target.$queryRaw<Array<{ version: string; checksum: string; applied_at: Date }>>`DELETE FROM etl.schema_migrations
      WHERE version = '0004_bi_operations.sql' RETURNING *`;
    await expect(apply()).rejects.toMatchObject({ code: 'BI_MIGRATION_INVALID' });
    const row = previous[0]!;
    await target.$executeRaw`INSERT INTO etl.schema_migrations VALUES (${row.version}, ${row.checksum}, ${row.applied_at})`;
    const before = await target.$queryRaw`SELECT * FROM etl.schema_migrations ORDER BY version`;
    expect(await apply()).toBe(true); expect(await apply()).toBe(false);
    expect(await target.$queryRaw`SELECT * FROM etl.schema_migrations WHERE version <> '0005_bi_statistics.sql' ORDER BY version`).toEqual(before);
    await expect(applyWarehouseMigration(target, '0005_bi_statistics.sql', migration + '\n-- drift\n'))
      .rejects.toMatchObject({ code: 'BI_MIGRATION_DRIFT' });
  });
  it('refuses migration with a live or expired ETL reservation', async () => {
    const warehouse = new WarehouseRepository(target); const lease = (await warehouse.claim(tenant, hourUtc(new Date())))!;
    await expect(apply()).rejects.toMatchObject({ code: 'BI_MAINTENANCE_REQUIRED' });
    await target.$executeRaw`UPDATE etl.tenant_load_state SET lease_until = clock_timestamp() - interval '1 second'`;
    await expect(apply()).rejects.toMatchObject({ code: 'BI_MAINTENANCE_REQUIRED' });
    await warehouse.fail(lease, 'BI_LEASE_LOST'); expect(await apply()).toBe(true);
  });
  it('publishes multiple tags without multiplying inventory, with restricted identities and tenant isolation', async () => {
    await apply(); await grants();
    const result = await load('2024-02-29T23:59:59.999Z', true, tenant, true);
    expect(result.counts).toEqual({ categories: 0n, testimonials: 2n, events: 0n, taxonomy: { tags: 2n, relations: 3n } });
    expect(await targetRead.$queryRaw`SELECT testimonial_count FROM dw.fact_tenant_snapshot WHERE tenant_id = ${tenant}::uuid`)
      .toEqual([{ testimonial_count: 2n }]);
    expect(await targetRead.$queryRaw`SELECT tag_count, relation_count FROM dw.fact_tag_snapshot WHERE tenant_id = ${tenant}::uuid`)
      .toEqual([{ tag_count: 2n, relation_count: 3n }]);
    expect(await targetRead.$queryRaw`SELECT count(*) AS n FROM dw.bridge_testimonial_tag_snapshot WHERE tenant_id = ${tenant}::uuid`)
      .toEqual([{ n: 3n }]);
    expect(await targetRead.$queryRaw`SELECT count(*) AS n FROM dw.dim_tag WHERE tenant_id = ${other}::uuid`).toEqual([{ n: 0n }]);
    expect(await target.$queryRaw`SELECT count(*) AS n FROM staging.tags`).toEqual([{ n: 0n }]);
    await expect(sourceRead.$queryRaw`SELECT content FROM public.testimonials`).rejects.toThrow();
    await expect(targetRead.$queryRaw`SELECT * FROM etl.statistics_jobs`).rejects.toThrow();
    await expect(targetWrite.$executeRaw`DELETE FROM dw.statistics_publication`).rejects.toThrow();
    await expect(targetWrite.$executeRaw`UPDATE dw.fact_testimonial_creation SET created_at = clock_timestamp()`).rejects.toThrow();
    await expect(targetWrite.$executeRaw`CREATE TABLE dw.forbidden (id int)`).rejects.toThrow();
  });
  it('distinguishes empty extracted taxonomy from legacy cuts with no tag observation', async () => {
    await apply();
    await load('2024-02-01T00:00:00Z', false);
    expect(await target.$queryRaw`SELECT count(*) AS n FROM dw.fact_tag_snapshot`).toEqual([{ n: 0n }]);
    await history.apply();
    await source.$executeRaw`DELETE FROM testimonial_tags WHERE tenant_id = ${tenant}::uuid`;
    await source.$executeRaw`DELETE FROM tags WHERE tenant_id = ${tenant}::uuid`;
    await source.$executeRaw`DELETE FROM testimonials WHERE tenant_id = ${tenant}::uuid`;
    await load('2024-03-01T00:00:00Z');
    expect(await target.$queryRaw`SELECT tag_count, relation_count FROM dw.fact_tag_snapshot`).toEqual([{ tag_count: 0n, relation_count: 0n }]);
    expect(await target.$queryRaw`SELECT count(*) AS n FROM dw.fact_testimonial_creation`).toEqual([{ n: 2n }]);
  });
  it('backfills only earliest real observations, preserves deleted identities, and replays without changes', async () => {
    await apply(); const first = await load('2024-02-29T23:59:59.999Z', false);
    await source.$executeRaw`DELETE FROM testimonial_tags WHERE testimonial_id = ${testimonial}::uuid`;
    await source.$executeRaw`DELETE FROM testimonials WHERE id = ${testimonial}::uuid`;
    const last = await load('2024-03-01T00:00:00Z', false);
    expect(await history.check()).toEqual({ tenants: 1n, pendingTenants: 1n, missingCreations: 2n });
    expect(await history.apply()).toEqual({ tenants: 1n, pendingTenants: 0n, missingCreations: 0n });
    const observations = await target.$queryRaw`SELECT testimonial_id, first_observed_run_id, first_observed_at FROM dw.fact_testimonial_creation
      WHERE tenant_id = ${tenant}::uuid ORDER BY testimonial_id`;
    expect(observations).toEqual([testimonial, second].sort().map(id => ({ testimonial_id: id, first_observed_run_id: first.lease.runId,
      first_observed_at: new Date('2024-02-29T23:59:59.999Z') })));
    await history.apply();
    expect(await target.$queryRaw`SELECT testimonial_id, first_observed_run_id, first_observed_at FROM dw.fact_testimonial_creation
      WHERE tenant_id = ${tenant}::uuid ORDER BY testimonial_id`).toEqual(observations);
    expect(await target.$queryRaw`SELECT creations_through_run_id FROM dw.statistics_history_state`).toEqual([{ creations_through_run_id: last.lease.runId }]);
    expect(await target.$queryRaw`SELECT count(*) AS n FROM dw.fact_tag_snapshot`).toEqual([{ n: 0n }]);
  });
  it('resumes interrupted batches without exposing a completion marker for partial history', async () => {
    await apply(); await load('2024-03-01T00:00:00Z', false);
    const signal = new AbortController();
    await expect(history.apply({ signal: signal.signal, afterBatch: () => { signal.abort(); } }))
      .rejects.toMatchObject({ code: 'BI_BACKFILL_INTERRUPTED' });
    expect(await history.check()).toEqual({ tenants: 1n, pendingTenants: 1n, missingCreations: 1n });
    expect(await target.$queryRaw`SELECT count(*) AS n FROM dw.statistics_history_state`).toEqual([{ n: 0n }]);
    expect(await history.apply()).toEqual({ tenants: 1n, pendingTenants: 0n, missingCreations: 0n });
  });
  it('rejects inconsistent creation dates across snapshots before the first backfill write', async () => {
    await apply(); await load('2024-02-01T00:00:00Z', false);
    await source.$executeRaw`UPDATE testimonials SET created_at = '2024-02-02Z' WHERE id = ${testimonial}::uuid`;
    await load('2024-03-01T00:00:00Z', false);
    await expect(history.apply()).rejects.toMatchObject({ code: 'BI_BACKFILL_INCONSISTENT' });
    expect(await target.$queryRaw`SELECT count(*) AS n FROM dw.fact_testimonial_creation`).toEqual([{ n: 0n }]);
  });
  it('rejects a source creation date change and preserves the last valid publication and marker', async () => {
    await apply(); const first = await load('2024-02-01T00:00:00Z');
    await source.$executeRaw`UPDATE testimonials SET created_at = '2024-02-02Z' WHERE id = ${testimonial}::uuid`;
    await expect(load('2024-03-01T00:00:00Z')).rejects.toMatchObject({ code: 'BI_SOURCE_INCONSISTENT' });
    expect(await target.$queryRaw`SELECT run_id FROM dw.fact_tenant_snapshot`).toEqual([{ run_id: first.lease.runId }]);
    expect(await target.$queryRaw`SELECT creations_through_run_id FROM dw.statistics_history_state`).toEqual([{ creations_through_run_id: first.lease.runId }]);
  });
  it('requires maintenance backfill after legacy-only cuts before statistics can publish again', async () => {
    await apply(); await load('2024-02-01T00:00:00Z');
    await load('2024-03-01T00:00:00Z', false);
    await expect(load('2024-04-01T00:00:00Z')).rejects.toMatchObject({ code: 'BI_BACKFILL_REQUIRED' });
    await history.apply(); await expect(load('2024-04-01T00:00:00Z')).resolves.toBeDefined();
  });
  it('rejects cross-tenant, absent and duplicate tag links in staging', async () => {
    await apply(); const warehouse = new WarehouseRepository(target, true);
    const lease = (await warehouse.claim(tenant, hourUtc(new Date())))!;
    await expect(warehouse.tags(lease, [{ tenantId: other, tagId: foreignTag, name: 'Synthetic' }]))
      .rejects.toMatchObject({ code: 'BI_SOURCE_INCONSISTENT' });
    await warehouse.tags(lease, [{ tenantId: tenant, tagId: tag, name: 'Synthetic' }]);
    await expect(warehouse.testimonialTags(lease, [{ tenantId: tenant, testimonialId: foreign, tagId: tag }]))
      .rejects.toMatchObject({ code: 'BI_SOURCE_INCONSISTENT' });
    const sourceRepo = new SourceRepository(sourceRead);
    await sourceRepo.extract(tenant, { snapshot: value => warehouse.snapshot(lease, value), categories: rows => warehouse.categories(lease, rows),
      testimonials: rows => warehouse.testimonials(lease, rows), events: rows => warehouse.events(lease, rows) });
    await warehouse.testimonialTags(lease, [{ tenantId: tenant, testimonialId: testimonial, tagId: tag }]);
    await expect(warehouse.testimonialTags(lease, [{ tenantId: tenant, testimonialId: testimonial, tagId: tag }]))
      .rejects.toMatchObject({ code: 'BI_SOURCE_INCONSISTENT' });
    await warehouse.fail(lease, 'BI_SOURCE_INCONSISTENT');
    expect(await target.$queryRaw`SELECT count(*) AS n FROM staging.testimonial_tags`).toEqual([{ n: 0n }]);
  });
  it('isolates optional preflight failures and never opens connections when disabled', async () => {
    expect(await statisticsDataReady(sourceRead, targetWrite, false)).toBe(false);
    expect(await statisticsDataReady(sourceRead, targetWrite, true)).toBe(false);
    await apply(); await grants(); expect(await statisticsDataReady(sourceRead, targetWrite, true)).toBe(true);
    await load('2024-02-01T00:00:00Z', false); expect(await statisticsDataReady(sourceRead, targetWrite, true)).toBe(false);
    await history.apply(); expect(await statisticsDataReady(sourceRead, targetWrite, true)).toBe(true);
    await target.$executeRawUnsafe(`REVOKE INSERT ON dw.fact_testimonial_creation FROM "${writer}"`);
    expect(await statisticsDataReady(sourceRead, targetWrite, true)).toBe(false);
    await target.$executeRawUnsafe(`GRANT INSERT ON dw.fact_testimonial_creation TO "${writer}"`);
    await source.$executeRawUnsafe(`REVOKE SELECT ON bi_export.tags FROM "${extractor}"`);
    try { expect(await statisticsDataReady(sourceRead, targetWrite, true)).toBe(false); }
    finally { await source.$executeRawUnsafe(`GRANT SELECT ON bi_export.tags TO "${extractor}"`); }
  });
  it('refuses history backfill while the worker has even an expired ETL reservation', async () => {
    await apply(); const warehouse = new WarehouseRepository(target);
    const lease = (await warehouse.claim(tenant, hourUtc(new Date())))!;
    await target.$executeRaw`UPDATE etl.tenant_load_state SET lease_until = clock_timestamp() - interval '1 second'`;
    await expect(history.apply()).rejects.toMatchObject({ code: 'BI_MAINTENANCE_REQUIRED' });
    await warehouse.fail(lease, 'BI_LEASE_LOST'); expect(await history.apply()).toEqual({ tenants: 0n, pendingTenants: 0n, missingCreations: 0n });
  });
  it('reads taxonomy and links from the same pinned source snapshot despite concurrent mutations', async () => {
    await apply();
    const tags: unknown[] = []; const links: unknown[] = [];
    const counts = await new SourceRepository(sourceRead, 1, true).extract(tenant, {
      snapshot: async () => {
        await source.$executeRaw`UPDATE tags SET name = 'Synthetic later name' WHERE id = ${tag}::uuid`;
        await source.$executeRaw`DELETE FROM testimonial_tags WHERE tenant_id = ${tenant}::uuid`;
      },
      categories: async () => undefined, testimonials: async () => undefined, events: async () => undefined,
      tags: async rows => { tags.push(...rows); }, testimonialTags: async rows => { links.push(...rows); },
    });
    expect(tags).toEqual(expect.arrayContaining([{ tenantId: tenant, tagId: tag, name: 'Synthetic service' }]));
    expect(links).toHaveLength(3); expect(counts.taxonomy).toEqual({ tags: 2n, relations: 3n });
  });
  it('rolls back all new statistical data when the final lease fence fails', async () => {
    await apply(); const first = await load('2024-02-01T00:00:00Z');
    const extra = randomUUID();
    await source.$executeRaw`INSERT INTO testimonials (id, tenant_id, status_id, rating)
      VALUES (${extra}::uuid, ${tenant}::uuid, 1, 4)`;
    class LostLease extends WarehouseRepository {
      protected override async publicationCompleted(tx: Prisma.TransactionClient, lease: Lease): Promise<void> {
        // Exercise the real final fence after every statistical write, before commit.
        await tx.$executeRaw`UPDATE etl.tenant_load_state SET lease_until = clock_timestamp() - interval '1 second'
          WHERE tenant_id = ${lease.tenantId}::uuid AND lease_token = ${lease.token}::uuid`;
      }
    }
    const warehouse = new LostLease(target, true);
    await expect(load('2024-03-01T00:00:00Z', true, tenant, false, warehouse)).rejects.toMatchObject({ code: 'BI_LEASE_LOST' });
    expect(await target.$queryRaw`SELECT run_id FROM dw.fact_tenant_snapshot`).toEqual([{ run_id: first.lease.runId }]);
    expect(await target.$queryRaw`SELECT run_id FROM dw.fact_tag_snapshot`).toEqual([{ run_id: first.lease.runId }]);
    expect(await target.$queryRaw`SELECT count(*) AS n FROM dw.fact_testimonial_creation`).toEqual([{ n: 2n }]);
    expect(await target.$queryRaw`SELECT creations_through_run_id FROM dw.statistics_history_state`).toEqual([{ creations_through_run_id: first.lease.runId }]);
  });
  it('rejects mismatched taxonomy totals without publishing a partial base or statistical cut', async () => {
    await apply();
    const warehouse = new WarehouseRepository(target, true);
    const publish = warehouse.publish.bind(warehouse);
    jest.spyOn(warehouse, 'publish').mockImplementation((lease, snapshot, counts) => publish(lease, snapshot,
      { ...counts, taxonomy: { tags: counts.taxonomy!.tags, relations: counts.taxonomy!.relations + 1n } }));
    await expect(load('2024-03-01T00:00:00Z', true, tenant, false, warehouse)).rejects.toMatchObject({ code: 'BI_SOURCE_INCONSISTENT' });
    expect(await target.$queryRaw`SELECT count(*) AS n FROM dw.fact_tenant_snapshot`).toEqual([{ n: 0n }]);
    expect(await target.$queryRaw`SELECT count(*) AS n FROM dw.statistics_history_state`).toEqual([{ n: 0n }]);
  });
  it('protects the bridge against tags owned by another published tenant', async () => {
    await apply(); const local = await load('2024-03-01T00:00:00Z'); await load('2024-03-01T00:00:00Z', true, other);
    await expect(target.$executeRaw`INSERT INTO dw.bridge_testimonial_tag_snapshot (tenant_id, run_id, testimonial_id, tag_id)
      VALUES (${tenant}::uuid, ${local.lease.runId}::uuid, ${testimonial}::uuid, ${foreignTag}::uuid)`).rejects.toThrow();
    expect(await history.check()).toEqual({ tenants: 2n, pendingTenants: 0n, missingCreations: 0n });
  });
  it('initializes an always-empty tenant from its observed header without inventing testimonials or tags', async () => {
    await apply();
    await source.$executeRaw`DELETE FROM testimonial_tags WHERE tenant_id = ${tenant}::uuid`;
    await source.$executeRaw`DELETE FROM testimonials WHERE tenant_id = ${tenant}::uuid`;
    const empty = await load('2024-03-01T00:00:00Z', false);
    expect(await history.check()).toEqual({ tenants: 1n, pendingTenants: 1n, missingCreations: 0n });
    expect(await history.apply()).toEqual({ tenants: 1n, pendingTenants: 0n, missingCreations: 0n });
    expect(await target.$queryRaw`SELECT creations_through_run_id FROM dw.statistics_history_state`).toEqual([{ creations_through_run_id: empty.lease.runId }]);
    expect(await target.$queryRaw`SELECT count(*) AS n FROM dw.fact_testimonial_creation`).toEqual([{ n: 0n }]);
    expect(await target.$queryRaw`SELECT count(*) AS n FROM dw.fact_tag_snapshot`).toEqual([{ n: 0n }]);
  });
  it('allows legacy recovery to clear abandoned testimonial staging through the new link cascade', async () => {
    await apply(); const warehouse = new WarehouseRepository(target, true);
    const slot = hourUtc(new Date()); const lease = (await warehouse.claim(tenant, slot))!;
    await new SourceRepository(sourceRead, 1, true).extract(tenant, {
      snapshot: value => warehouse.snapshot(lease, value), categories: rows => warehouse.categories(lease, rows),
      testimonials: rows => warehouse.testimonials(lease, rows), events: rows => warehouse.events(lease, rows),
      tags: rows => warehouse.tags(lease, rows), testimonialTags: rows => warehouse.testimonialTags(lease, rows),
    });
    await target.$executeRaw`UPDATE etl.tenant_load_state SET lease_until = clock_timestamp() - interval '1 second'`;
    const legacy = new WarehouseRepository(target);
    const recovered = (await legacy.claim(tenant, slot))!;
    expect(recovered.runId).not.toBe(lease.runId);
    expect(await target.$queryRaw`SELECT count(*) AS n FROM staging.testimonial_tags`).toEqual([{ n: 0n }]);
    expect(await target.$queryRaw`SELECT count(*) AS n FROM staging.testimonials`).toEqual([{ n: 0n }]);
    // Labels are not read by the disabled feature; maintenance must clear these terminal-run rows.
    expect(await target.$queryRaw`SELECT count(*) AS n FROM staging.tags`).toEqual([{ n: 2n }]);
    await legacy.fail(recovered, 'BI_ETL_FAILED');
  });
  it('runs statistics only after base ETL and processes at most one task per real worker cycle', async () => {
    await apply(); await grants();
    await target.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE ON etl.tenant_settings, etl.worker_health,
      etl.statistics_jobs, dw.statistics_current TO "${writer}"`);
    await target.$executeRawUnsafe(`GRANT SELECT, UPDATE ON etl.load_requests TO "${writer}"`);
    const previous = { source: process.env.BI_SOURCE_DATABASE_URL, warehouse: process.env.BI_ETL_DATABASE_URL,
      enabled: process.env.BI_STATISTICS_ENABLED, exitCode: process.exitCode };
    const log = jest.spyOn(ConsoleLogger.prototype, 'log').mockImplementation(() => undefined);
    const warn = jest.spyOn(ConsoleLogger.prototype, 'warn').mockImplementation(() => undefined);
    const origin = new URL(sourceUrl!); origin.pathname = `/${sourceDb}`; origin.username = extractor; origin.password = '';
    const destination = new URL(targetUrl!); destination.pathname = `/${targetDb}`; destination.username = writer; destination.password = '';
    try {
      process.env.BI_SOURCE_DATABASE_URL = origin.toString(); process.env.BI_ETL_DATABASE_URL = destination.toString();
      process.env.BI_STATISTICS_ENABLED = 'true';
      await worker(['--once']);
      expect(warn).not.toHaveBeenCalled();
      expect(await target.$queryRaw`SELECT count(*) AS n FROM etl.runs WHERE status = 'succeeded'`).toEqual([{ n: 2n }]);
      expect(await target.$queryRaw`SELECT status, count(*) AS n FROM etl.statistics_jobs GROUP BY status ORDER BY status`)
        .toEqual([{ status: 'pending', n: 1n }, { status: 'succeeded', n: 1n }]);
      const events = log.mock.calls.map(call => (call[0] as { event?: string }).event);
      expect(events.lastIndexOf('bi.etl_tenant_finished')).toBeLessThan(events.indexOf('bi.statistics_task_finished'));
      await worker(['--once']);
      expect(await target.$queryRaw`SELECT count(*) AS n FROM etl.runs WHERE status = 'succeeded'`).toEqual([{ n: 2n }]);
      expect(await target.$queryRaw`SELECT count(*) AS n FROM dw.statistics_publication`).toEqual([{ n: 2n }]);
    } finally {
      log.mockRestore(); warn.mockRestore(); process.exitCode = previous.exitCode;
      if (previous.source === undefined) delete process.env.BI_SOURCE_DATABASE_URL; else process.env.BI_SOURCE_DATABASE_URL = previous.source;
      if (previous.warehouse === undefined) delete process.env.BI_ETL_DATABASE_URL; else process.env.BI_ETL_DATABASE_URL = previous.warehouse;
      if (previous.enabled === undefined) delete process.env.BI_STATISTICS_ENABLED; else process.env.BI_STATISTICS_ENABLED = previous.enabled;
    }
  });
});
