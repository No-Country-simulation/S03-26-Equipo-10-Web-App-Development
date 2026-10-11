import { pathToFileURL } from 'node:url';
import { prepareEnvironment, profiles, DemoConfigurationError } from './config.mjs';
import { inspectConnection } from './permissions.mjs';

export async function main(args = process.argv.slice(2), env = process.env) {
  const [service, mode, ...extra] = args;
  if (extra.length || !['--offline', '--connect'].includes(mode)) throw new DemoConfigurationError('DEMO_ARGUMENTS_INVALID');
  const prepared = prepareEnvironment(service, env);
  try {
    const checks = [];
    for (const name of prepared.names) {
      if (mode === '--offline') { checks.push({ connection: name, passed: true, pool: profiles[name].pool }); continue; }
      const { PrismaClient } = await import('@prisma/client');
      // The check uses one connection per identity; it never changes runtime pool limits.
      const url = new URL(prepared.env[name]); url.searchParams.set('connection_limit', '1');
      const client = new PrismaClient({ datasources: { db: { url: url.toString() } }, log: [] });
      try { checks.push({ connection: name, ...await inspectConnection(client, profiles[name].role) }); }
      catch { checks.push({ connection: name, passed: false, issues: ['CONNECTION_OR_QUERY_FAILED'] }); }
      finally { await client.$disconnect(); }
    }
    const passed = checks.every(c => c.passed);
    console.log(JSON.stringify({ event: 'demo.preflight', service, mode, passed, checks,
      providerAcceptance: 'pending: Data API setting, IPv6 egress, ingress, capacity and HTTPS' }));
    return passed;
  } finally { prepared.cleanup(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(passed => { process.exitCode = passed ? 0 : 1; }).catch(error => {
    console.error(JSON.stringify({ event: 'demo.preflight_failed', code: error instanceof DemoConfigurationError ? error.message : 'DEMO_CONFIGURATION_INVALID' }));
    process.exitCode = 1;
  });
}
