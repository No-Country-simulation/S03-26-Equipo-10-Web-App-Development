import { seedBiStatisticsSource } from './fixtures/bi-statistics-system';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import {
  createBiSystem,
  systemConfigured,
} from './fixtures/bi-system-environment';
import { WorkerControlRepository } from '../src/modules/business-intelligence/repositories/worker-control.repository';
import { SourceRepository } from '../src/modules/business-intelligence/repositories/source.repository';
import { ManagedWarehouseRepository } from '../src/modules/business-intelligence/repositories/managed-warehouse.repository';
import { EtlService } from '../src/modules/business-intelligence/services/etl.service';
import { StatisticsJobRepository } from '../src/modules/business-intelligence/repositories/statistics-job.repository';

const integration = systemConfigured() ? describe : describe.skip;
integration(
  'statistics: real CMS sessions, Redis, CLI, restoration and failures',
  () => {
    jest.setTimeout(120000);
    let system: Awaited<ReturnType<typeof createBiSystem>>;
    let app: INestApplication;
    let admin: string;
    let editor: string;
    let foreign: string;
    let beforeReport: unknown;
    let pendingRun: string;
    let restoredUrl: string;
    let restoredAdmin: PrismaClient;
    const nativeUrl = (value: string) => {
      const url = new URL(value);
      url.search = '';
      return url.toString();
    };
    async function login(email: string) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Auth-Mode', 'bearer')
        .send({ email, password: system.password })
        .expect(201);
      return response.body.data.tokens.accessToken as string;
    }
    const get = (path: string, token = admin) =>
      request(app.getHttpServer())
        .get(`/api/v1/${path}`)
        .auth(token, { type: 'bearer' });
    function worker(env = system.workerEnv, expectedFailure = false) {
      let failed = false;
      try {
        execFileSync(
          process.execPath,
          [
            '-r',
            'ts-node/register/transpile-only',
            'src/modules/business-intelligence/etl.cli.ts',
            '--once',
          ],
          {
            cwd: process.cwd(),
            env: { ...process.env, ...env },
            stdio: 'pipe',
            timeout: 90000,
          },
        );
      } catch {
        failed = true;
      }
      expect(failed).toBe(expectedFailure);
    }
    beforeAll(async () => {
      system = await createBiSystem({ statistics: true });
      await seedBiStatisticsSource(system);
      app = await system.startApi();
      admin = await login(system.users[0]!.admin.email);
      editor = await login(system.users[0]!.editor.email);
      foreign = await login(system.users[1]!.admin.email);
      await new WorkerControlRepository(system.target).heartbeat(randomUUID());
    });
    afterAll(async () => {
      await system?.close();
    });

    it('publishes taxonomy from the real CLI and reads only the authenticated tenant after reopening the API', async () => {
      await get('bi/statistics')
        .expect(200)
        .expect((response) =>
          expect(response.body.data.publicationStatus).toBe('not_loaded'),
        );
      for (const token of [admin, foreign])
        await request(app.getHttpServer())
          .post('/api/v1/bi/requests')
          .auth(token, { type: 'bearer' })
          .set('Idempotency-Key', randomUUID())
          .send({ kind: 'manual' })
          .expect(202);
      worker();
      worker();
      await app.close();
      app = await system.startApi();
      const a = (await get('bi/statistics', editor).expect(200)).body.data;
      const b = (await get('bi/statistics', foreign).expect(200)).body.data;
      expect(a).toMatchObject({
        publicationStatus: 'current',
        patterns: {
          totalTestimonials: '100',
          withoutTags: { count: '50', ratio: 0.5 },
        },
        forecast: { value: null, reason: 'INSUFFICIENT_HISTORY' },
      });
      expect(a.patterns.associations).toEqual([
        expect.objectContaining({
          count: '10',
          support: 0.1,
          confidenceAB: 0.25,
          confidenceBA: 0.5,
          lift: 1.25,
        }),
      ]);
      expect(a.publication.sourceRunId).not.toBe(b.publication.sourceRunId);
      expect(
        a.patterns.tags.items.map((tag: { id: string }) => tag.id),
      ).not.toEqual(b.patterns.tags.items.map((tag: { id: string }) => tag.id));
      expect(JSON.stringify(a)).not.toMatch(
        /Private synthetic|authorName|password|postgresql:|content|lease_token/,
      );
      expect(a.anomalies.items).toHaveLength(180);
      beforeReport = a;
      await get(`bi/statistics?tenantId=${system.users[1]!.company.id}`).expect(
        400,
      );
      await get('health/ready').expect(200);
    });
    it('keeps successful ETL and prior reports after three statistical publication failures', async () => {
      const company = await system.source.tenant.create({
        data: { name: 'Synthetic failing statistics' },
      });
      await system.source.testimonial.create({
        data: {
          tenantId: company.id,
          content: 'Synthetic valid content',
          authorName: 'Fixture',
          rating: 5,
          statusId: 4,
        },
      });
      await system.target.$executeRawUnsafe(
        "CREATE FUNCTION dw.reject_statistics_fixture() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'private synthetic statistics failure'; END $$",
      );
      await system.target.$executeRawUnsafe(
        'CREATE TRIGGER reject_statistics_fixture BEFORE INSERT ON dw.statistics_publication FOR EACH ROW EXECUTE FUNCTION dw.reject_statistics_fixture()',
      );
      try {
        for (let i = 0; i < 3; i++) worker(system.workerEnv, true);
      } finally {
        await system.target.$executeRawUnsafe(
          'DROP TRIGGER reject_statistics_fixture ON dw.statistics_publication',
        );
        await system.target.$executeRawUnsafe(
          'DROP FUNCTION dw.reject_statistics_fixture()',
        );
      }
      expect(
        await system.target
          .$queryRaw`SELECT status, attempt_count FROM etl.statistics_jobs WHERE tenant_id = ${company.id}::uuid`,
      ).toEqual([{ status: 'failed', attempt_count: 3 }]);
      expect(
        await system.target
          .$queryRaw`SELECT status FROM etl.runs WHERE tenant_id = ${company.id}::uuid`,
      ).toEqual([{ status: 'succeeded' }]);
      const result = (await get('bi/statistics').expect(200)).body.data;
      expect(result.publication).toEqual(
        (beforeReport as { publication: unknown }).publication,
      );
      expect(result.patterns).toEqual(
        (beforeReport as { patterns: unknown }).patterns,
      );
    });
    it('restores all thirty tables and ACL, then recovers pending statistics without duplicating its report', async () => {
      const company = await system.source.tenant.create({
        data: { name: 'Synthetic pending statistics restoration' },
      });
      const source = new PrismaClient({
        datasources: { db: { url: system.workerEnv.BI_SOURCE_DATABASE_URL } },
      });
      const writer = system.clientFor(system.roles.writerRole);
      try {
        expect(
          (
            await new EtlService(
              new SourceRepository(source, 1000, true),
              new ManagedWarehouseRepository(writer, true),
            ).runTenant(company.id)
          ).status,
        ).toBe('succeeded');
      } finally {
        await source.$disconnect();
      }
      await new StatisticsJobRepository(writer).discover();
      const [job] = await system.target.$queryRaw<
        Array<{ run: string }>
      >`SELECT source_run_id AS run FROM etl.statistics_jobs WHERE tenant_id = ${company.id}::uuid AND status = 'pending'`;
      pendingRun = job!.run;
      async function fingerprints(client: PrismaClient) {
        const tables = await client.$queryRaw<
          Array<{ schema: string; name: string }>
        >`SELECT schemaname AS schema, tablename AS name
        FROM pg_tables WHERE schemaname IN ('etl', 'staging', 'dw') ORDER BY 1, 2`;
        expect(tables).toHaveLength(30);
        const rows = [];
        for (const table of tables) {
          const identifier = [table.schema, table.name]
            .map((value) => '"' + value.replaceAll('"', '""') + '"')
            .join('.');
          rows.push({
            table: `${table.schema}.${table.name}`,
            rows: await client.$queryRawUnsafe(`SELECT count(*)::text AS count,
          md5(coalesce(string_agg(row_to_json(t)::text, E'\\n' ORDER BY row_to_json(t)::text), '')) AS digest FROM ${identifier} t`),
          });
        }
        return rows;
      }
      const directory = await mkdtemp(join(tmpdir(), 'bi-statistics-restore-'));
      const file = join(directory, 'warehouse.dump');
      try {
        const before = await fingerprints(system.target);
        execFileSync(
          'pg_dump',
          [
            '--format=custom',
            '--file',
            file,
            '--dbname',
            nativeUrl(system.targetUrl),
          ],
          { stdio: 'pipe', timeout: 60000 },
        );
        const restored = await system.restoreDatabase();
        restoredUrl = restored.url;
        restoredAdmin = restored.client;
        execFileSync(
          'pg_restore',
          [
            '--exit-on-error',
            '--single-transaction',
            '--no-owner',
            '--dbname',
            nativeUrl(restored.url),
            file,
          ],
          { stdio: 'pipe', timeout: 60000 },
        );
        expect(await fingerprints(restored.client)).toEqual(before);
        const restoredWriter = system.clientFor(
          system.roles.writerRole,
          restored.url,
        );
        await expect(
          restoredWriter.$executeRaw`UPDATE dw.statistics_publication SET payload = payload WHERE false`,
        ).rejects.toThrow();
        const workerUrl = new URL(restored.url);
        workerUrl.username = system.roles.writerRole;
        worker({
          ...system.workerEnv,
          BI_ETL_DATABASE_URL: workerUrl.toString(),
        });
        worker({
          ...system.workerEnv,
          BI_ETL_DATABASE_URL: workerUrl.toString(),
        });
        expect(
          await restored.client
            .$queryRaw`SELECT status, attempt_count FROM etl.statistics_jobs WHERE source_run_id = ${pendingRun}::uuid`,
        ).toEqual([{ status: 'succeeded', attempt_count: 1 }]);
        expect(
          await restored.client
            .$queryRaw`SELECT count(*) AS n FROM dw.statistics_publication WHERE source_run_id = ${pendingRun}::uuid`,
        ).toEqual([{ n: 1n }]);
        const readerUrl = new URL(restored.url);
        readerUrl.username = system.roles.readRole;
        system.configure({ BI_DATABASE_URL: readerUrl.toString() });
        await app.close();
        app = await system.startApi();
        expect(
          (await get('bi/statistics').expect(200)).body.data.patterns,
        ).toEqual((beforeReport as { patterns: unknown }).patterns);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });
    it('denies new object writes to readers/control and immutable edits to the worker, before and after restore', async () => {
      for (const url of [system.targetUrl, restoredUrl]) {
        const reader = system.clientFor(system.roles.readRole, url);
        const control = system.clientFor(system.roles.controlRole, url);
        const writer = system.clientFor(system.roles.writerRole, url);
        await expect(
          reader.$queryRaw`SELECT * FROM etl.statistics_jobs`,
        ).rejects.toThrow();
        await expect(
          control.$queryRaw`SELECT * FROM dw.statistics_publication`,
        ).rejects.toThrow();
        await expect(
          reader.$executeRaw`DELETE FROM dw.statistics_current WHERE false`,
        ).rejects.toThrow();
        await expect(
          writer.$executeRaw`UPDATE dw.fact_testimonial_creation SET created_at = created_at WHERE false`,
        ).rejects.toThrow();
        await expect(
          writer.$executeRaw`DELETE FROM dw.statistics_publication WHERE false`,
        ).rejects.toThrow();
      }
    });
    it('keeps CMS capture, moderation and readiness alive while the statistics reader loses access', async () => {
      await system.target.$executeRawUnsafe(
        `ALTER ROLE "${system.roles.readRole}" NOLOGIN`,
      );
      await restoredAdmin.$queryRaw`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database()
      AND usename = ${system.roles.readRole} AND pid <> pg_backend_pid()`;
      try {
        const response = await get('bi/statistics').expect(503);
        expect(response.body.code).toBe('BI_STATISTICS_UNAVAILABLE');
        expect(response.headers['cache-control']).toBe('private, no-store');
        expect(JSON.stringify(response.body)).not.toMatch(
          /Prisma|postgresql:|SELECT|password|stack/,
        );
        await get('health/ready').expect(200);
        await get('health/live').expect(200);
        await get('testimonials?limit=20').expect(200);
        const captured = await request(app.getHttpServer())
          .post('/api/v1/testimonials')
          .auth(admin, { type: 'bearer' })
          .send({
            content: 'Synthetic capture during statistical outage',
            authorName: 'Synthetic',
            rating: 5,
          })
          .expect(201);
        for (const action of ['submit', 'approve'])
          await request(app.getHttpServer())
            .post(`/api/v1/testimonials/${captured.body.data.id}/${action}`)
            .auth(admin, { type: 'bearer' })
            .send({})
            .expect(201);
      } finally {
        await system.target.$executeRawUnsafe(
          `ALTER ROLE "${system.roles.readRole}" LOGIN`,
        );
      }
      await get('bi/statistics').expect(200);
    });
    it('disables statistical HTTP without losing the existing dashboard or stored reports', async () => {
      system.configure({ BI_STATISTICS_ENABLED: 'false' });
      await app.close();
      app = await system.startApi();
      expect((await get('bi/statistics').expect(503)).body.code).toBe(
        'BI_STATISTICS_DISABLED',
      );
      await get('bi/dashboard').expect(200);
      await get('health/ready').expect(200);
      expect(
        await system.clientFor(system.roles.readRole, restoredUrl)
          .$queryRaw`SELECT count(*) AS n FROM dw.statistics_publication WHERE source_run_id = ${pendingRun}::uuid`,
      ).toEqual([{ n: 1n }]);
    });
  },
);
