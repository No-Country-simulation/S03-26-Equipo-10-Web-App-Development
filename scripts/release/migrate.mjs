import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  certificatePem,
  connectionUrl,
  projectHosts,
} from '../demo/config.mjs';
import { command } from './providers.mjs';
import { fail, shaPattern } from './qualify.mjs';

export function migrationPlan(env, target, sha, confirmation) {
  if (
    !['oltp', 'warehouse'].includes(target) ||
    !shaPattern.test(sha ?? '') ||
    confirmation !==
      `APPLY ${sha} ${target}${target === 'warehouse' && env.DEMO_BI_STATISTICS_MIGRATION === 'true' ? ' statistics' : ''}` ||
    env.DEMO_MIGRATIONS_ENABLED !== 'true'
  )
    fail('RELEASE_MIGRATION_ACK_REQUIRED');
  if (
    env.DEMO_BI_STATISTICS_MIGRATION !== undefined &&
    !['true', 'false'].includes(env.DEMO_BI_STATISTICS_MIGRATION)
  )
    fail('RELEASE_MIGRATION_TARGET_INVALID');
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0')
    fail('RELEASE_MIGRATION_TLS_REQUIRED');
  const project = target === 'oltp' ? 'OLTP' : 'WAREHOUSE';
  const role = target === 'oltp' ? 'cms_migrator' : 'bi_migrator';
  // No connection, DDL or child process until every input is validated.
  const hosts = projectHosts(env);
  const pem = certificatePem(env[`${project}_CA_PEM`]);
  const directory = mkdtempSync(join(tmpdir(), 'demo-migration-ca-'));
  const cleanup = () => rmSync(directory, { recursive: true, force: true });
  try {
    const path = join(directory, 'ca.crt');
    writeFileSync(path, pem, { mode: 0o600 });
    const url = connectionUrl(
      env.MIGRATION_DATABASE_URL,
      { role, project, pool: 1 },
      hosts,
      path,
    );
    const childEnv = {
      ...env,
      ...(target === 'oltp'
        ? { DATABASE_URL: url }
        : { BI_MIGRATION_DATABASE_URL: url }),
    };
    const args =
      target === 'oltp'
        ? [
            '/app/node_modules/prisma/build/index.js',
            'migrate',
            'deploy',
            '--schema=/app/apps/api/prisma/schema.prisma',
          ]
        : [
            '/app/apps/api/dist/modules/business-intelligence/migration.cli.js',
            '--apply',
            '--to',
            env.DEMO_BI_STATISTICS_MIGRATION === 'true'
              ? '0005_bi_statistics.sql'
              : '0004_bi_operations.sql',
          ];
    return { args, env: childEnv, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let plan;
  try {
    const [target, sha, confirmation, ...extra] = process.argv.slice(2);
    if (extra.length) fail('RELEASE_MIGRATION_ARGUMENTS_INVALID');
    plan = migrationPlan(process.env, target, sha, confirmation);
    command(process.execPath, plan.args, { env: plan.env, timeout: 600000 });
    console.log(
      JSON.stringify({ event: 'release.migration_applied', target, sha }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'release.migration_failed',
        code: /^RELEASE_[A-Z_]+$/.test(error.message)
          ? error.message
          : 'RELEASE_MIGRATION_FAILED',
      }),
    );
    process.exitCode = 1;
  } finally {
    plan?.cleanup();
  }
}
