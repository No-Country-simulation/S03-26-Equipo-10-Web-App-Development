// Explicit local test: two disposable PostgreSQL servers, no provider credentials or persistent migrations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { inspectConnection } from './permissions.mjs';

const require = createRequire(import.meta.url);
const { AuthRepository } = require('../../apps/api/dist/modules/auth/repositories/auth.repository.js');
const bi = name => require(`../../apps/api/dist/modules/business-intelligence/${name}.js`);
const { WorkerControlRepository } = bi('repositories/worker-control.repository');
const { OperationsControlRepository } = bi('repositories/operations-control.repository');
const { SourceRepository } = bi('repositories/source.repository');
const { ManagedWarehouseRepository } = bi('repositories/managed-warehouse.repository');
const { EtlService } = bi('services/etl.service');
const root = resolve(import.meta.dirname, '../..');
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

test('TLS, role separation, effective denials and real registration on PostgreSQL 17 fixtures', { timeout: 180000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'demo-db-test-'));
  const containers = [];
  const clients = [];
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', join(directory, 'server.key'),
      '-out', join(directory, 'server.crt'), '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost'], { stdio: 'ignore' });
    const servers = {};
    for (const project of ['oltp', 'warehouse']) {
      const id = docker('run', '-d', '--rm', '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust',
        '-p', '127.0.0.1::5432', '--mount', `type=bind,src=${directory},dst=/tls,readonly`, '--entrypoint', 'sh', 'postgres:17-alpine', '-c',
        'cp /tls/server.key /tmp/server.key && cp /tls/server.crt /tmp/server.crt && chown postgres:postgres /tmp/server.key /tmp/server.crt && chmod 600 /tmp/server.key && exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/tmp/server.crt -c ssl_key_file=/tmp/server.key');
      containers.push(id);
      let ready = false;
      for (let i = 0; i < 60; i++) {
        try { docker('exec', id, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'); ready = true; break; } catch { await wait(500); }
      }
      assert.ok(ready, 'fixture readiness');
      const port = JSON.parse(docker('inspect', id))[0].NetworkSettings.Ports['5432/tcp'][0].HostPort;
      const sql = text => execFileSync('docker', ['exec', '-i', id, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'],
        { input: text, stdio: ['pipe', 'pipe', 'pipe'] });
      sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;\n');
      sql(readFileSync(resolve(root, `docs/operations/demo/${project}-bootstrap.sql`), 'utf8'));
      servers[project] = { sql, port };
    }
    const schema = execFileSync(process.execPath, [resolve(root, 'node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-empty',
      '--to-schema-datamodel', resolve(root, 'apps/api/prisma/schema.prisma'), '--script'], { encoding: 'utf8' });
    servers.oltp.sql('SET ROLE cms_migrator;\n' + schema + '\nCREATE TABLE public._prisma_migrations (id text);\n'
      + readFileSync(resolve(root, 'apps/api/prisma/migrations/20261008010000_bi_export_views/migration.sql'), 'utf8'));
    for (const name of ['0001_initial', '0002_snapshot_time_expand', '0003_snapshot_time_constraints', '0004_bi_operations']) {
      servers.warehouse.sql('SET ROLE bi_migrator;\n' + readFileSync(resolve(root, `apps/api/warehouse/migrations/${name}.sql`), 'utf8'));
    }
    servers.warehouse.sql("SET ROLE bi_migrator; INSERT INTO etl.schema_migrations(version, checksum) VALUES ('0004_bi_operations.sql', repeat('0',64));");
    for (const project of ['oltp', 'warehouse']) {
      servers[project].sql(readFileSync(resolve(root, `docs/operations/demo/${project}-grants.sql`), 'utf8'));
    }
    const connection = (role, project, tls = true, ca = join(directory, 'server.crt'), host = 'localhost') => {
      servers[project].sql(`ALTER ROLE ${role} LOGIN;`); // Fixed fixture role names only.
      const url = new URL(`postgresql://${host}:${servers[project].port}/postgres`); url.username = role;
      url.searchParams.set('connection_limit', '1'); url.searchParams.set('connect_timeout', '5');
      url.searchParams.set('sslmode', tls ? 'require' : 'disable'); url.searchParams.set('sslaccept', 'strict'); url.searchParams.set('sslcert', ca);
      const client = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] }); clients.push(client); return client;
    };
    for (const [role, project] of [['cms_runtime', 'oltp'], ['bi_source_reader', 'oltp'], ['bi_api_reader', 'warehouse'], ['bi_control', 'warehouse'], ['bi_etl_writer', 'warehouse']]) {
      const result = await inspectConnection(connection(role, project), role);
      assert.equal(result.passed, true, `${role}: ${result.issues.join(',')}`);
      assert.ok(result.version >= 170000 && result.version < 180000);
    }
    const runtime = connection('cms_runtime', 'oltp');
    const user = await new AuthRepository(runtime).createTenantAndAdmin({ tenantName: 'Synthetic permission tenant', email: 'permissions@example.test', passwordHash: 'synthetic-fixture-hash' });
    assert.deepEqual(user.roles, ['admin']);
    await runtime.auditLog.create({ data: { tenantId: user.tenantId, userId: user.id, action: 'FIXTURE', resourceType: 'fixture' } });
    const status = await runtime.testimonialStatus.findUniqueOrThrow({ where: { code: 'published' } });
    const testimonial = await runtime.testimonial.create({ data: { tenantId: user.tenantId, content: 'Synthetic permission content', authorName: 'Fixture', rating: 5, statusId: status.id } });
    const eventType = await runtime.analyticsEventType.create({ data: { code: 'view' } });
    await runtime.analyticsEvent.create({ data: { tenantId: user.tenantId, testimonialId: testimonial.id, eventTypeId: eventType.id } });
    const source = connection('bi_source_reader', 'oltp');
    const rows = await source.$queryRaw`SELECT tenant_id FROM bi_export.tenants`;
    assert.equal(rows.length, 1);
    await assert.rejects(() => source.$queryRaw`SELECT email FROM public.users`);
    const control = connection('bi_control', 'warehouse');
    const writer = connection('bi_etl_writer', 'warehouse');
    const worker = new WorkerControlRepository(writer);
    await worker.ready(); await worker.provision([user.tenantId]); await worker.heartbeat(randomUUID());
    const controls = new OperationsControlRepository({ write: work => control.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL transaction_timeout = '10s'`;
      return work(tx);
    }) });
    const identity = { tenantId: user.tenantId, actorId: user.id };
    await controls.updateSettings(identity, { expectedVersion: 1, frequencyHours: 6 });
    const cancelled = await controls.createRequest(identity, randomUUID(), { kind: 'manual' }, true);
    assert.equal((await controls.cancelRequest(identity, cancelled.request.id, randomUUID())).status, 'cancelled');
    const accepted = await controls.createRequest(identity, randomUUID(), { kind: 'manual' }, true);
    const result = await new EtlService(new SourceRepository(source, 1000), new ManagedWarehouseRepository(writer)).runTenant(user.tenantId, undefined, 'cli');
    assert.equal(result.status, 'succeeded');
    const reader = connection('bi_api_reader', 'warehouse');
    const [request] = await reader.$queryRaw`SELECT status FROM etl.load_requests WHERE id = ${accepted.request.id}::uuid`;
    assert.equal(request.status, 'succeeded');
    const [published] = await reader.$queryRaw`SELECT count(*)::int AS count FROM dw.fact_testimonial_snapshot WHERE tenant_id = ${user.tenantId}::uuid`;
    assert.equal(published.count, 1);
    await assert.rejects(() => control.$executeRaw`UPDATE etl.worker_health SET stopping = true`);
    await assert.rejects(() => control.$executeRaw`UPDATE etl.load_requests SET actor_id = gen_random_uuid()`);
    await assert.rejects(() => runtime.$executeRaw`CREATE TABLE public.forbidden (id int)`);
    const noTls = await inspectConnection(connection('cms_runtime', 'oltp', false), 'cms_runtime');
    assert.ok(noTls.issues.includes('TLS'));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', join(directory, 'wrong.key'),
      '-out', join(directory, 'wrong.crt'), '-subj', '/CN=localhost'], { stdio: 'ignore' });
    await assert.rejects(() => inspectConnection(connection('cms_runtime', 'oltp', true, join(directory, 'wrong.crt')), 'cms_runtime'));
    await assert.rejects(() => inspectConnection(connection('cms_runtime', 'oltp', true, join(directory, 'server.crt'), '127.0.0.1'), 'cms_runtime'));
    servers.warehouse.sql('GRANT UPDATE (actor_id) ON etl.load_requests TO bi_control;');
    assert.ok((await inspectConnection(control, 'bi_control')).issues.includes('COLUMN_PRIVILEGES'));
    servers.warehouse.sql('REVOKE UPDATE (actor_id) ON etl.load_requests FROM bi_control; GRANT pg_read_all_data TO bi_control;');
    assert.ok((await inspectConnection(control, 'bi_control')).issues.includes('ROLE_PRIVILEGES'));
    servers.oltp.sql('GRANT SELECT (email) ON public.users TO anon;');
    assert.ok((await inspectConnection(runtime, 'cms_runtime')).issues.includes('DATA_API_GRANTS'));
    writeFileSync(join(directory, 'complete'), 'passed');
  } finally {
    await Promise.allSettled(clients.map(client => client.$disconnect()));
    for (const id of containers) { try { docker('rm', '-f', id); } catch { /* Already removed. */ } }
    rmSync(directory, { recursive: true, force: true });
  }
});
