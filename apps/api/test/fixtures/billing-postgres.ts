import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

export async function createBillingDatabase(parentUrl: string) {
  const parent = new PrismaClient({ datasources: { db: { url: parentUrl } } });
  const dbName = `billing_test_${randomUUID().replaceAll('-', '')}`;
  const roles: string[] = [];
  const databases = [dbName];
  const clients: PrismaClient[] = [];
  const childUrl = (name: string) => {
    const parsed = new URL(parentUrl);
    parsed.pathname = `/${name}`;
    parsed.searchParams.set('schema', 'public');
    parsed.searchParams.set('connection_limit', '4');
    return parsed.toString();
  };
  async function close() {
    await Promise.all(clients.map((client) => client.$disconnect()));
    try {
      for (const name of databases.reverse())
        await parent.$executeRawUnsafe(
          `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`,
        );
      for (const role of roles)
        await parent.$executeRawUnsafe(`DROP ROLE IF EXISTS "${role}"`);
    } finally {
      await parent.$disconnect();
    }
  }
  try {
    await parent.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
    const url = childUrl(dbName);
    // Fixed CLI and schema; the only target is the database created just above.
    execFileSync(
      process.execPath,
      [
        resolve(__dirname, '../../../../node_modules/prisma/build/index.js'),
        'migrate',
        'deploy',
        '--schema',
        resolve(__dirname, '../../prisma/schema.prisma'),
      ],
      {
        env: {
          ...process.env,
          DATABASE_URL: url,
          PRISMA_HIDE_UPDATE_MESSAGE: '1',
        },
        stdio: 'pipe',
        timeout: 60000,
      },
    );
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    clients.push(prisma);
    return {
      prisma,
      url,
      close,
      async runtimeClient() {
        const role = `billing_runtime_${randomUUID().replaceAll('-', '')}`;
        roles.push(role);
        const password = randomBytes(24).toString('hex');
        await parent.$executeRawUnsafe(
          `CREATE ROLE "${role}" LOGIN PASSWORD '${password}'`,
        );
        await prisma.$executeRawUnsafe(
          `GRANT USAGE ON SCHEMA public TO "${role}"`,
        );
        await prisma.$executeRawUnsafe(
          `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${role}"`,
        );
        await prisma.$executeRawUnsafe(
          `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${role}"`,
        );
        await prisma.$executeRawUnsafe(
          `REVOKE INSERT, UPDATE, DELETE ON billing_platform_operators FROM "${role}"`,
        );
        await prisma.$executeRawUnsafe(
          `REVOKE UPDATE, DELETE ON billing_audit FROM "${role}"`,
        );
        const parsed = new URL(url);
        parsed.username = role;
        parsed.password = password;
        const runtime = new PrismaClient({
          datasources: { db: { url: parsed.toString() } },
        });
        clients.push(runtime);
        return runtime;
      },
      async restoredClient() {
        const name = `billing_restore_${randomUUID().replaceAll('-', '')}`;
        databases.push(name);
        const envFor = (database: string) => {
          const parsed = new URL(parentUrl);
          return {
            ...process.env,
            PGHOST: parsed.hostname,
            PGPORT: parsed.port || '5432',
            PGUSER: decodeURIComponent(parsed.username),
            PGPASSWORD: decodeURIComponent(parsed.password),
            PGDATABASE: database,
          };
        };
        const dump = execFileSync(
          'pg_dump',
          ['--format=custom', '--no-owner', '--no-acl'],
          { env: envFor(dbName), timeout: 60000 },
        );
        await parent.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
        const restored = spawnSync(
          'pg_restore',
          ['--dbname', name, '--no-owner', '--no-acl', '--exit-on-error'],
          { env: envFor(name), input: dump, timeout: 60000 },
        );
        if (restored.status !== 0)
          throw new Error('BILLING_TEST_RESTORE_FAILED');
        const client = new PrismaClient({
          datasources: { db: { url: childUrl(name) } },
        });
        clients.push(client);
        return client;
      },
    };
  } catch {
    await close();
    throw new Error('BILLING_TEST_DATABASE_SETUP_FAILED');
  }
}
