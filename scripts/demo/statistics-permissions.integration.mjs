// Requires two explicitly disposable loopback PostgreSQL servers; creates/drops its own DBs and fixed fixture roles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { inspectConnection } from './permissions.mjs';
const root = resolve(import.meta.dirname, '../..');
const input = [
  process.env.TEST_BI_SOURCE_DATABASE_URL,
  process.env.TEST_BI_WAREHOUSE_DATABASE_URL,
];
const enabled = input.every(Boolean);
test(
  'statistics grant proposals and effective restrictions, with TLS deliberately reported separately',
  { skip: !enabled, timeout: 90000 },
  async () => {
    const projects = [];
    const clients = [];
    const roles = {
      oltp: [
        'anon',
        'authenticated',
        'service_role',
        'cms_migrator',
        'cms_runtime',
        'bi_source_reader',
      ],
      warehouse: [
        'anon',
        'authenticated',
        'service_role',
        'bi_migrator',
        'bi_api_reader',
        'bi_control',
        'bi_etl_writer',
      ],
    };
    try {
      for (const [i, name] of ['oltp', 'warehouse'].entries()) {
        const parent = new URL(input[i]);
        assert.ok(
          ['127.0.0.1', 'localhost'].includes(parent.hostname),
          'loopback fixtures only',
        );
        if (i)
          assert.notEqual(
            parent.port,
            new URL(input[0]).port,
            'independent servers',
          );
        parent.search = '';
        const database = `stats_grants_${randomUUID().replaceAll('-', '')}`;
        const sqlAt = (url, sql) =>
          execFileSync(
            'psql',
            ['--dbname', url.toString(), '-v', 'ON_ERROR_STOP=1', '-q'],
            { input: sql, stdio: 'pipe' },
          );
        const existing = execFileSync(
          'psql',
          [
            '--dbname',
            parent.toString(),
            '-At',
            '-c',
            `SELECT rolname FROM pg_roles WHERE rolname IN (${roles[name].map((role) => `'${role}'`).join(',')})`,
          ],
          { encoding: 'utf8' },
        ).trim();
        assert.equal(existing, '', 'never reuse/drop existing roles');
        sqlAt(parent, `CREATE DATABASE "${database}";`);
        const db = new URL(parent);
        db.pathname = '/' + database;
        const project = {
          name,
          parent,
          db,
          database,
          sql: (sql) => sqlAt(db, sql),
        };
        projects.push(project);
        project.sql(
          'CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;',
        );
        project.sql(
          readFileSync(
            resolve(root, `docs/operations/demo/${name}-bootstrap.sql`),
            'utf8',
          ),
        );
        if (name === 'oltp') {
          const ddl = readFileSync(
            process.env.TEST_BI_BENCHMARK_SCHEMA_FILE,
            'utf8',
          );
          project.sql(
            'SET ROLE cms_migrator;\n' +
              ddl +
              '\nCREATE TABLE public._prisma_migrations (id text);\n' +
              readFileSync(
                resolve(
                  root,
                  'apps/api/prisma/migrations/20261008010000_bi_export_views/migration.sql',
                ),
                'utf8',
              ) +
              '\n' +
              readFileSync(
                resolve(
                  root,
                  'apps/api/prisma/migrations/20261019000000_bi_statistics_export/migration.sql',
                ),
                'utf8',
              ),
          );
        } else {
          for (const version of [
            '0001_initial.sql',
            '0002_snapshot_time_expand.sql',
            '0003_snapshot_time_constraints.sql',
            '0004_bi_operations.sql',
            '0005_bi_statistics.sql',
          ]) {
            const ddl = readFileSync(
              resolve(root, 'apps/api/warehouse/migrations', version),
              'utf8',
            );
            project.sql('SET ROLE bi_migrator;\n' + ddl);
            project.sql(
              `SET ROLE bi_migrator; INSERT INTO etl.schema_migrations(version, checksum) VALUES ('${version}', '${createHash('sha256').update(ddl).digest('hex')}');`,
            );
          }
        }
        project.sql(
          readFileSync(
            resolve(root, `docs/operations/demo/${name}-grants.sql`),
            'utf8',
          ),
        );
        project.sql(
          readFileSync(
            resolve(root, `docs/operations/demo/${name}-statistics-grants.sql`),
            'utf8',
          ),
        );
        project.sql(`REVOKE CREATE ON DATABASE "${database}" FROM PUBLIC;`);
      }
      function client(role, project) {
        project.sql(`ALTER ROLE ${role} LOGIN;`);
        const url = new URL(project.db);
        url.username = role;
        url.searchParams.set('connection_limit', '1');
        url.searchParams.set('sslmode', 'disable');
        const connection = new PrismaClient({
          datasources: { db: { url: url.toString() } },
          log: [],
        });
        clients.push(connection);
        return connection;
      }
      for (const project of projects)
        for (const role of roles[project.name].filter(
          (role) =>
            ![
              'anon',
              'authenticated',
              'service_role',
              'cms_migrator',
              'bi_migrator',
            ].includes(role),
        )) {
          const connection = client(role, project);
          // These loopback servers do not test TLS; every other production preflight assertion remains active.
          for (const statistics of [false, true])
            assert.deepEqual(
              (await inspectConnection(connection, role, statistics)).issues,
              ['TLS'],
            );
        }
      const warehouse = projects[1];
      const writer = client('bi_etl_writer', warehouse);
      const reader = client('bi_api_reader', warehouse);
      await assert.rejects(
        () =>
          writer.$executeRaw`UPDATE dw.statistics_publication SET payload = payload WHERE false`,
      );
      await assert.rejects(
        () =>
          writer.$executeRaw`DELETE FROM dw.fact_testimonial_creation WHERE false`,
      );
      await assert.rejects(
        () => reader.$queryRaw`SELECT * FROM etl.statistics_jobs`,
      );
      warehouse.sql(
        'GRANT UPDATE ON dw.statistics_publication TO bi_etl_writer;',
      );
      assert.ok(
        (
          await inspectConnection(writer, 'bi_etl_writer', false)
        ).issues.includes('TABLE_PRIVILEGES'),
      );
      warehouse.sql(
        "REVOKE UPDATE ON dw.statistics_publication FROM bi_etl_writer; DELETE FROM etl.schema_migrations WHERE version='0005_bi_statistics.sql';",
      );
      assert.ok(
        (
          await inspectConnection(writer, 'bi_etl_writer', true)
        ).issues.includes('STATISTICS_PROTOCOL'),
      );
      assert.deepEqual(
        (await inspectConnection(writer, 'bi_etl_writer', false)).issues,
        ['TLS'],
      );
    } finally {
      await Promise.allSettled(clients.map((client) => client.$disconnect()));
      for (const project of projects) {
        execFileSync(
          'psql',
          [
            '--dbname',
            project.parent.toString(),
            '-v',
            'ON_ERROR_STOP=1',
            '-q',
          ],
          {
            input: `DROP DATABASE "${project.database}" WITH (FORCE); DROP ROLE IF EXISTS ${roles[project.name].join(',')};`,
            stdio: 'pipe',
          },
        );
      }
    }
  },
);
