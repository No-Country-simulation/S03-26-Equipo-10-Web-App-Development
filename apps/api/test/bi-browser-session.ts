/** Manual browser acceptance against real local services; opt-in, disposable environments only. */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createBiSystem } from './fixtures/bi-system-environment';

async function main() {
  if (process.argv[2] !== '--serve') throw new Error('BI_BROWSER_OPT_IN_REQUIRED');
  const system = await createBiSystem();
  let worker: ReturnType<typeof spawn> | undefined;
  try {
    await system.startApi(4104);
    worker = spawn(process.execPath, ['-r', 'ts-node/register/transpile-only', 'src/modules/business-intelligence/etl.cli.ts'],
      { env: { ...process.env, ...system.workerEnv }, stdio: ['ignore', 'ignore', 'ignore'] });
    worker.once('error', () => { process.exitCode = 1; process.emit('SIGTERM'); });
    worker.once('exit', code => { if (code) { process.exitCode = 1; process.emit('SIGTERM'); } });
    process.stdout.write('BI_BROWSER_READY: real API 4104; independent worker; two synthetic companies; real Redis\n');
    await Promise.race([once(process, 'SIGINT'), once(process, 'SIGTERM')]);
  } finally {
    if (worker && worker.exitCode === null && worker.signalCode === null) {
      const stopped = once(worker, 'exit'); worker.kill('SIGTERM'); await stopped;
    }
    await system.close();
  }
}
void main().catch(() => { process.stderr.write('BI_BROWSER_FAILED\n'); process.exitCode = 1; });
