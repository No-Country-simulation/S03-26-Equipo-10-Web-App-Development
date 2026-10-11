import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { prepareEnvironment, DemoConfigurationError } from './config.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
try {
  const [service, ...extra] = process.argv.slice(2);
  if (extra.length) throw new DemoConfigurationError('DEMO_ARGUMENTS_INVALID');
  const prepared = prepareEnvironment(service, process.env);
  const args = service === 'api'
    ? ['--require', resolve(root, 'apps/api/dist/telemetry.js'), resolve(root, 'apps/api/dist/main.js')]
    : [resolve(root, 'apps/api/dist/modules/business-intelligence/etl.cli.js')];
  const child = spawn(process.execPath, args, { cwd: root, env: prepared.env, stdio: 'inherit' });
  const forward = signal => { if (!child.killed) child.kill(signal); };
  const sigterm = () => forward('SIGTERM');
  const sigint = () => forward('SIGINT');
  process.on('SIGTERM', sigterm);
  process.on('SIGINT', sigint);
  const finish = code => {
    process.off('SIGTERM', sigterm); process.off('SIGINT', sigint);
    prepared.cleanup(); process.exitCode = code;
  };
  child.once('error', () => { console.error(JSON.stringify({ event: 'demo.start_failed', code: 'DEMO_PROCESS_FAILED' })); finish(1); });
  child.once('exit', (code, signal) => finish(code ?? (signal === 'SIGTERM' ? 143 : signal === 'SIGINT' ? 130 : 1)));
} catch (error) {
  console.error(JSON.stringify({ event: 'demo.start_failed', code: error instanceof DemoConfigurationError ? error.message : 'DEMO_CONFIGURATION_INVALID' }));
  process.exitCode = 1;
}
