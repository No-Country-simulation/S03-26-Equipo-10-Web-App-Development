/** Real local browser fixture. No credentials/output from a deployed environment. */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createBiSystem } from './fixtures/bi-system-environment';
import { seedBiStatisticsSource } from './fixtures/bi-statistics-system';
async function main() {
  if (process.argv[2] !== '--serve')
    throw new Error('BI_STATISTICS_BROWSER_OPT_IN');
  const system = await createBiSystem({ statistics: true });
  let worker: ReturnType<typeof spawn> | undefined;
  try {
    await seedBiStatisticsSource(system);
    system.configure({ CORS_ORIGIN: 'http://127.0.0.1:3105' });
    await system.startApi(4105);
    worker = spawn(
      process.execPath,
      [
        '-r',
        'ts-node/register/transpile-only',
        'src/modules/business-intelligence/etl.cli.ts',
      ],
      { env: { ...process.env, ...system.workerEnv }, stdio: 'ignore' },
    );
    worker.once('error', () => {
      process.exitCode = 1;
      process.emit('SIGTERM');
    });
    process.stdout.write(
      'BI_STATISTICS_BROWSER_READY: real CMS API/worker; two synthetic tenants; real Redis\n',
    );
    await Promise.race([once(process, 'SIGINT'), once(process, 'SIGTERM')]);
  } finally {
    if (worker && worker.exitCode === null && worker.signalCode === null) {
      const exit = once(worker, 'exit');
      worker.kill('SIGTERM');
      await exit;
    }
    await system.close();
  }
}
void main().catch(() => {
  process.stderr.write('BI_STATISTICS_BROWSER_FAILED\n');
  process.exitCode = 1;
});
