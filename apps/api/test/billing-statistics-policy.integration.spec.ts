import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { createBillingDatabase } from './fixtures/billing-postgres';
import { StatisticsJobRepository } from '../src/modules/business-intelligence/repositories/statistics-job.repository';
import { STATISTICS_VERSION } from '../src/modules/business-intelligence/statistics.types';
const parent =
  process.env.TEST_BILLING_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
(parent ? describe : describe.skip)(
  'statistics suspension SQL with shipped lifecycle constraints',
  () => {
    let fixture: Awaited<ReturnType<typeof createBillingDatabase>>,
      db: PrismaClient;
    beforeAll(async () => {
      fixture = await createBillingDatabase(parent!);
      db = fixture.prisma;
      await db.$executeRawUnsafe('CREATE SCHEMA dw');
      await db.$executeRawUnsafe('CREATE SCHEMA etl');
      // Minimal parent fixtures, not the full warehouse: the job table and CHECKs are the shipped SQL verbatim.
      await db.$executeRawUnsafe(
        'CREATE TABLE dw.fact_tenant_snapshot(tenant_id uuid,run_id uuid,snapshot_at timestamptz(3),snapshot_date_key date,PRIMARY KEY(tenant_id,run_id,snapshot_at,snapshot_date_key))',
      );
      await db.$executeRawUnsafe(
        'CREATE TABLE dw.statistics_history_state(tenant_id uuid PRIMARY KEY,creations_through_run_id uuid)',
      );
      // Fixed repository DDL path; no caller-controlled filename.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const source = readFileSync(
        resolve(__dirname, '../warehouse/migrations/0005_bi_statistics.sql'),
        'utf8',
      );
      const statement = source.match(
        /CREATE TABLE etl\.statistics_jobs \([\s\S]*?\n\);/,
      )?.[0];
      if (!statement) throw Error('shipped job DDL missing');
      await db.$executeRawUnsafe(statement);
    }, 90000);
    beforeEach(async () => {
      await db.$executeRawUnsafe(
        'TRUNCATE etl.statistics_jobs,dw.statistics_history_state,dw.fact_tenant_snapshot',
      );
    });
    afterAll(async () => {
      await fixture?.close();
    }, 30000);
    async function seed(tenantId: string = randomUUID(), attempt = 1) {
      const runId = randomUUID(),
        token = randomUUID(),
        at = new Date();
      await db.$executeRaw`INSERT INTO dw.fact_tenant_snapshot VALUES(${tenantId}::uuid,${runId}::uuid,${at},${at}::date)`;
      await db.$executeRaw`INSERT INTO dw.statistics_history_state VALUES(${tenantId}::uuid,${runId}::uuid)`;
      await db.$executeRaw`INSERT INTO etl.statistics_jobs(tenant_id,source_run_id,algorithm_version,source_snapshot_at,source_snapshot_date_key,status,attempt_count,created_at,claimed_at,lease_token,lease_until,deadline_at)
   SELECT tenant_id,run_id,${STATISTICS_VERSION},snapshot_at,snapshot_date_key,'running',${attempt},${at},${at},${token}::uuid,${at}::timestamptz+interval '60 seconds',${at}::timestamptz+interval '60 seconds' FROM dw.fact_tenant_snapshot WHERE tenant_id=${tenantId}::uuid`;
      return {
        tenantId,
        sourceRunId: runId,
        token,
        sourceSnapshotAt: at,
        deadline: Date.now() + 60000,
      };
    }
    test('defer preserves prior failed attempts and releases only its fenced running claim', async () => {
      const repo = new StatisticsJobRepository(db);
      const lease = await seed(undefined, 2);
      expect(await repo.defer({ ...lease, token: randomUUID() })).toBe(0);
      expect(await repo.defer(lease)).toBe(1);
      expect(await repo.defer(lease)).toBe(0);
      const [row] = await db.$queryRaw<
        Array<{
          status: string;
          attempt_count: number;
          lease_token: string | null;
        }>
      >`SELECT status,attempt_count,lease_token FROM etl.statistics_jobs`;
      expect(row).toEqual({
        status: 'failed',
        attempt_count: 1,
        lease_token: null,
      });
    });
    test('first suspended attempt returns to pending without budget consumption', async () => {
      const repo = new StatisticsJobRepository(db);
      const lease = await seed();
      expect(await repo.defer(lease)).toBe(1);
      const [row] = await db.$queryRaw<
        Array<{
          status: string;
          attempt_count: number;
          claimed_at: Date | null;
        }>
      >`SELECT status,attempt_count,claimed_at FROM etl.statistics_jobs`;
      expect(row).toEqual({
        status: 'pending',
        attempt_count: 0,
        claimed_at: null,
      });
    });
    test('a full page of denied tenants cannot starve an eligible tenant on the next bounded tick', async () => {
      const ids = Array.from(
        { length: 101 },
        (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
      );
      for (const id of ids) {
        await seed(id);
      }
      await db.$executeRaw`UPDATE etl.statistics_jobs SET status='pending',attempt_count=0,claimed_at=NULL,lease_token=NULL,lease_until=NULL,deadline_at=NULL`;
      const eligible = jest.fn(
        async (tenantId: string) => tenantId === ids[100],
      );
      const repo = new StatisticsJobRepository(db, eligible);
      expect(await repo.claim()).toBeNull();
      expect(eligible).toHaveBeenCalledTimes(100);
      const claim = await repo.claim();
      expect(claim?.tenantId).toBe(ids[100]);
      expect(eligible).toHaveBeenCalledTimes(101);
      expect(
        await db.$queryRaw`SELECT count(*)::integer AS count FROM etl.statistics_jobs WHERE status='running'`,
      ).toEqual([{ count: 1 }]);
    });
  },
);
