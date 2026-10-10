/** Full CMS + two disposable PostgreSQL servers + real disposable Redis. Never deployed URLs. */
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import { ApiExceptionFilter } from '../../src/common/filters/api-exception.filter';
import { ApiResponseInterceptor } from '../../src/common/interceptors/api-response.interceptor';
import { PasswordService } from '../../src/modules/shared/hashing/password.service';
import { OperationsControlRepository } from '../../src/modules/business-intelligence/repositories/operations-control.repository';
import { applyWarehouseMigration, migrationStatements } from '../../src/modules/business-intelligence/repositories/warehouse-migrations';
import { installBiWarehouse } from './bi-warehouse';

export function systemConfigured(): boolean {
  return Boolean(process.env.TEST_BI_SOURCE_DATABASE_URL && process.env.TEST_BI_WAREHOUSE_DATABASE_URL
    && process.env.TEST_BI_BENCHMARK_SCHEMA_FILE && process.env.TEST_BI_REDIS_URL);
}

export async function createBiSystem() {
  if (!systemConfigured()) throw new Error('BI_SYSTEM_CONFIGURATION_REQUIRED');
  const suffix = randomUUID().replaceAll('-', '');
  const sourceDb = `bi_system_source_${suffix}`; const targetDb = `bi_system_dw_${suffix}`;
  const extractRole = `bi_sys_extract_${suffix}`; const writerRole = `bi_sys_writer_${suffix}`;
  const readRole = `bi_sys_read_${suffix}`; const controlRole = `bi_sys_control_${suffix}`;
  const sourceParent = new PrismaClient({ datasources: { db: { url: process.env.TEST_BI_SOURCE_DATABASE_URL! } } });
  const targetParent = new PrismaClient({ datasources: { db: { url: process.env.TEST_BI_WAREHOUSE_DATABASE_URL! } } });
  function url(parent: string, database: string, role?: string, limit = 2) {
    const parsed = new URL(parent); parsed.pathname = `/${database}`; parsed.searchParams.set('connection_limit', String(limit));
    if (role) { parsed.username = role; parsed.password = ''; } return parsed.toString();
  }
  const sourceUrl = url(process.env.TEST_BI_SOURCE_DATABASE_URL!, sourceDb, undefined, 8);
  const targetUrl = url(process.env.TEST_BI_WAREHOUSE_DATABASE_URL!, targetDb);
  const source = new PrismaClient({ datasources: { db: { url: sourceUrl } } });
  const target = new PrismaClient({ datasources: { db: { url: targetUrl } } });
  const workerEnv = { BI_SOURCE_DATABASE_URL: url(sourceUrl, sourceDb, extractRole, 1), BI_ETL_DATABASE_URL: url(targetUrl, targetDb, writerRole) };
  const roles = { extractRole, writerRole, readRole, controlRole };
  const clients: PrismaClient[] = [source, target]; const apps: INestApplication[] = [];
  const restoreDatabases: string[] = [];
  const savedEnv = new Map<string, string | undefined>();
  function configure(values: Record<string, string>) {
    // Internal literal configuration below; no request-controlled environment keys.
    // eslint-disable-next-line security/detect-object-injection
    for (const [key, value] of Object.entries(values)) { if (!savedEnv.has(key)) savedEnv.set(key, process.env[key]); process.env[key] = value; }
  }
  async function close() {
    await Promise.allSettled(apps.map(app => app.close()));
    await Promise.allSettled(clients.map(client => client.$disconnect()));
    for (const database of [targetDb, ...restoreDatabases]) await targetParent.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await sourceParent.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${sourceDb}" WITH (FORCE)`);
    for (const role of [writerRole, readRole, controlRole]) await targetParent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${role}"`);
    await sourceParent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${extractRole}"`);
    await Promise.allSettled([sourceParent.$disconnect(), targetParent.$disconnect()]);
    // Only keys saved by configure's literal internal configuration.
    // eslint-disable-next-line security/detect-object-injection
    for (const [key, value] of savedEnv) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
  try {
    await sourceParent.$executeRawUnsafe(`CREATE DATABASE "${sourceDb}"`); await targetParent.$executeRawUnsafe(`CREATE DATABASE "${targetDb}"`);
    // Explicit local DDL input generated from the checked-in Prisma schema; not a web path.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const ddl = await readFile(process.env.TEST_BI_BENCHMARK_SCHEMA_FILE!, 'utf8');
    for (const sql of migrationStatements(ddl)) await source.$executeRawUnsafe(sql);
    // Fixed repository migration, not caller input.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const views = await readFile(join(__dirname, '../../prisma/migrations/20261008010000_bi_export_views/migration.sql'), 'utf8');
    for (const sql of migrationStatements(views)) await source.$executeRawUnsafe(sql);
    await installBiWarehouse(target);
    // Fixed repository migration, not caller input.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    await applyWarehouseMigration(target, '0004_bi_operations.sql', await readFile(join(__dirname, '../../warehouse/migrations/0004_bi_operations.sql'), 'utf8'));
    await sourceParent.$executeRawUnsafe(`CREATE ROLE "${extractRole}" LOGIN`);
    for (const role of [writerRole, readRole, controlRole]) await targetParent.$executeRawUnsafe(`CREATE ROLE "${role}" LOGIN`);
    await source.$executeRawUnsafe(`GRANT USAGE ON SCHEMA bi_export TO "${extractRole}"`);
    await source.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA bi_export TO "${extractRole}"`);
    await target.$executeRawUnsafe(`REVOKE CREATE ON DATABASE "${targetDb}" FROM PUBLIC`);
    await target.$executeRawUnsafe(`GRANT USAGE ON SCHEMA dw, staging, etl TO "${writerRole}"`);
    await target.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA dw, staging TO "${writerRole}"`);
    await target.$executeRawUnsafe(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA dw TO "${writerRole}"`);
    await target.$executeRawUnsafe(`GRANT SELECT ON etl.schema_migrations TO "${writerRole}"`);
    await target.$executeRawUnsafe(`GRANT SELECT, INSERT, UPDATE ON etl.runs, etl.tenant_load_state, etl.tenant_settings, etl.worker_health TO "${writerRole}"`);
    await target.$executeRawUnsafe(`GRANT SELECT, UPDATE ON etl.load_requests TO "${writerRole}"`);
    await target.$executeRawUnsafe(`GRANT USAGE ON SCHEMA dw, etl TO "${readRole}"`);
    await target.$executeRawUnsafe(`GRANT SELECT ON ALL TABLES IN SCHEMA dw TO "${readRole}"`);
    await target.$executeRawUnsafe(`GRANT USAGE ON SCHEMA etl TO "${controlRole}"`);
    await target.$executeRawUnsafe(`GRANT SELECT ON etl.tenant_settings, etl.load_requests, etl.control_audit, etl.runs, etl.tenant_load_state, etl.worker_health TO "${controlRole}", "${readRole}"`);
    await target.$executeRawUnsafe(`GRANT INSERT ON etl.tenant_settings, etl.load_requests, etl.control_audit TO "${controlRole}"`);
    await target.$executeRawUnsafe(`GRANT UPDATE ON etl.tenant_settings TO "${controlRole}"`);
    await target.$executeRawUnsafe(`GRANT UPDATE (status, finished_at, error_code) ON etl.load_requests TO "${controlRole}"`);
    const adminRole = await source.role.create({ data: { code: 'admin' } });
    const editorRole = await source.role.create({ data: { code: 'editor' } });
    await source.testimonialStatus.createMany({ data: ['draft', 'pending', 'approved', 'published', 'rejected'].map(code => ({ code })) });
    await source.analyticsEventType.createMany({ data: ['view', 'click', 'play'].map(code => ({ code })) });
    const flag = await source.featureFlag.create({ data: { name: 'testimonials' } });
    const companies = await Promise.all(['A', 'B'].map(name => source.tenant.create({ data: { name: `Empresa BI sintética ${name}` } })));
    const password = 'Synthetic-BI-Only-2026!'; // Public test fixture, never a production credential.
    const hash = await new PasswordService().hashPassword(password);
    const users = [];
    for (const [index, company] of companies.entries()) {
      await source.tenantFeatureFlag.create({ data: { tenantId: company.id, featureFlagId: flag.id } });
      const category = await source.category.create({ data: { tenantId: company.id, name: '=Categoría sintética' } });
      const testimonial = await source.testimonial.create({ data: { tenantId: company.id, categoryId: category.id, statusId: 4,
        content: 'Contenido sintético privado que no debe exportarse', authorName: 'Autor sintético privado', rating: 5, publishedAt: new Date() } });
      await source.analyticsEvent.createMany({ data: [1, 1, 2, 3].map(eventTypeId => ({ tenantId: company.id, testimonialId: testimonial.id, eventTypeId, source: 'widget' })) });
      const admin = await source.user.create({ data: { tenantId: company.id, email: `admin-bi-${index}@example.test`, passwordHash: hash, roles: { create: { roleId: adminRole.id } } } });
      const editor = await source.user.create({ data: { tenantId: company.id, email: `editor-bi-${index}@example.test`, passwordHash: hash, roles: { create: { roleId: editorRole.id } } } });
      await new OperationsControlRepository({ write: work => target.$transaction(work) }).updateSettings(
        { tenantId: company.id, actorId: admin.id }, { expectedVersion: 0, scheduleEnabled: false });
      users.push({ admin, editor, company, testimonial });
    }
    configure({ NODE_ENV: 'test', DATABASE_URL: sourceUrl, REDIS_URL: process.env.TEST_BI_REDIS_URL!,
      JWT_SECRET: randomBytes(32).toString('hex'), API_KEY_PEPPERS_JSON: JSON.stringify({ 1: randomBytes(32).toString('base64url') }),
      WEBHOOK_SECRET_KEYS_JSON: '', BI_ENABLED: 'true', BI_OPERATIONS_ENABLED: 'true',
      BI_DATABASE_URL: url(targetUrl, targetDb, readRole), BI_CONTROL_DATABASE_URL: url(targetUrl, targetDb, controlRole),
      CORS_ORIGIN: 'http://127.0.0.1:3104' });
    async function startApi(port = 0) {
      const { AppModule } = await import('../../src/app.module');
      const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
      const app = module.createNestApplication({ logger: false }); apps.push(app);
      app.use(cookieParser()); app.enableCors({ origin: process.env.CORS_ORIGIN, credentials: true }); app.setGlobalPrefix('api/v1');
      app.useGlobalPipes(new ZodValidationPipe()); app.useGlobalFilters(new ApiExceptionFilter()); app.useGlobalInterceptors(new ApiResponseInterceptor());
      await app.listen(port, '127.0.0.1'); return app;
    }
    function clientFor(role: string, databaseUrl = targetUrl) {
      const database = new URL(databaseUrl).pathname.slice(1);
      const client = new PrismaClient({ datasources: { db: { url: url(databaseUrl, database, role) } } }); clients.push(client); return client;
    }
    async function restoreDatabase() {
      const name = `bi_system_restore_${randomUUID().replaceAll('-', '')}`; restoreDatabases.push(name);
      await targetParent.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
      const restoredUrl = url(targetUrl, name); const client = new PrismaClient({ datasources: { db: { url: restoredUrl } } }); clients.push(client);
      return { url: restoredUrl, client };
    }
    return { source, target, sourceUrl, targetUrl, sourceDb, targetDb, roles, users, password, workerEnv, startApi, clientFor, restoreDatabase, close };
  } catch (error) { await close(); throw error; }
}
