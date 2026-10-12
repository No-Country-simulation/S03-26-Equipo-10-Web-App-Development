/** Full-stack E2E: only owned, disposable Docker services; no external URL input. */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createServer as httpsServer, get as httpsGet } from 'node:https';
import { get as httpGet, request as httpRequest } from 'node:http';
import { createServer as netServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
  assertMigrationConsent,
  assertOwner,
  ownerLabel,
  resourceName,
  validateContainer,
} from './managed.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const webDir = join(root, 'apps/web');
const runId = randomBytes(6).toString('hex');
// Versions used by the project, resolved by digest for reproducible fixtures.
const images = {
  pg: 'postgres:18-alpine@sha256:77f585114c32fbca283dc835b0596f4e52b51b4c6662d7810b2f4084f60a1873',
  redis:
    'redis:7-alpine@sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499',
};
// Do not inherit provider credentials, DATABASE_URL, NODE_OPTIONS or auth config.
const env = Object.fromEntries(
  ['PATH', 'HOME', 'TMPDIR', 'LANG', 'CI', 'PLAYWRIGHT_BROWSERS_PATH']
    .filter((key) => process.env[key] !== undefined)
    .map((key) => [key, process.env[key]]),
);
Object.assign(env, { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' });
const children = new Set();
const created = [];
let temporary;
let front;
let networkCreated = false;
let imageCreated = false;
let interrupted = false;
const imageName = resourceName(runId, 'image');
const networkName = resourceName(runId, 'network');
const startedAt = new Date().toISOString();

function start(command, args, extra = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'ignore'],
    ...extra,
  });
  children.add(child);
  child.once('close', () => children.delete(child));
  return child;
}
async function command(operation, executable, args, extra = {}) {
  if (interrupted) throw new Error('E2E interrupted');
  const child = start(executable, args, { timeout: 600_000, ...extra });
  let output = '';
  child.stdout.on('data', (chunk) => {
    if (output.length < 1_000_000) output += chunk;
  });
  return new Promise((resolveCommand, reject) => {
    child.once('error', () =>
      reject(new Error(`${operation}: executable unavailable`)),
    );
    child.once('close', (code, signal) =>
      code === 0
        ? resolveCommand(output.trim())
        : reject(new Error(`${operation} failed (${code ?? signal})`)),
    );
  });
}
const docker = (operation, args, extra) =>
  command(operation, 'docker', args, extra);
async function inspect(kind) {
  return JSON.parse(
    await docker('Inspect owned container', [
      'inspect',
      resourceName(runId, kind),
    ]),
  )[0];
}
async function freePort() {
  const server = netServer();
  await new Promise((res, rej) => {
    server.once('error', rej);
    server.listen(0, '127.0.0.1', res);
  });
  const port = server.address().port;
  await new Promise((res) => server.close(res));
  return port;
}
async function waitFor(label, probe, alive = () => true) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (interrupted || !alive()) throw new Error(`${label}: process exited`);
    try {
      if (await probe()) return;
    } catch {
      /* bounded readiness polling, not test retries */
    }
    await delay(250);
  }
  throw new Error(`${label}: readiness timeout`);
}
function healthy(url, secure = false) {
  return new Promise((resolveHealth) => {
    const req = (secure ? httpsGet : httpGet)(
      url,
      { rejectUnauthorized: false, timeout: 2000 },
      (res) => {
        res.resume();
        resolveHealth(res.statusCode === 200);
      },
    );
    req.once('timeout', () => req.destroy());
    req.once('error', () => resolveHealth(false));
  });
}
async function rejectEnvFiles() {
  for (const directory of [
    root,
    webDir,
    join(root, 'apps/api'),
    join(root, 'apps/api/prisma'),
  ]) {
    for (const name of [
      '.env',
      '.env.local',
      '.env.production',
      '.env.production.local',
    ]) {
      const exists = await stat(join(directory, name)).then(
        () => true,
        (error) => {
          if (error.code === 'ENOENT') return false;
          throw error;
        },
      );
      if (exists)
        throw new Error(
          'E2E requires a checkout without local .env files; never load provider credentials',
        );
    }
  }
}
async function cleanup() {
  // Stop the browser/web processes before removing their services.
  for (const child of children) {
    child.kill('SIGTERM');
    await Promise.race([
      new Promise((res) => child.once('close', res)),
      delay(5000),
    ]);
    if (child.exitCode === null && child.signalCode === null)
      child.kill('SIGKILL');
  }
  if (front) {
    front.closeAllConnections();
    await new Promise((res) => front.close(res));
  }
  interrupted = false; // cleanup commands still run after SIGINT/SIGTERM
  const failures = [];
  for (const kind of created.reverse()) {
    try {
      assertOwner(await inspect(kind), runId, kind);
      await docker(
        'Remove owned container',
        ['rm', '--force', '--volumes', resourceName(runId, kind)],
        { timeout: 20_000 },
      );
    } catch {
      failures.push(kind);
    }
  }
  if (networkCreated) {
    try {
      const network = JSON.parse(
        await docker('Inspect owned network', [
          'network',
          'inspect',
          networkName,
        ]),
      )[0];
      assertOwner(network, runId, 'network');
      await docker('Remove owned network', ['network', 'rm', networkName], {
        timeout: 20_000,
      });
    } catch {
      failures.push('network');
    }
  }
  if (imageCreated) {
    try {
      const image = JSON.parse(
        await docker('Inspect owned image', ['image', 'inspect', imageName]),
      )[0];
      if (image.Config.Labels?.[ownerLabel] !== runId)
        throw new Error('Image ownership mismatch');
      await docker('Remove owned image', ['image', 'rm', imageName], {
        timeout: 20_000,
      });
    } catch {
      failures.push('image');
    }
  }
  if (temporary) await rm(temporary, { recursive: true, force: true });
  if (failures.length)
    throw new Error(
      `Cleanup incomplete for run ${runId}: ${failures.join(', ')}`,
    );
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    interrupted = true;
    for (const child of children) child.kill('SIGTERM');
  });

try {
  if (process.argv.length !== 2)
    throw new Error('test:e2e does not accept runner overrides');
  assertMigrationConsent(process.env.E2E_ALLOW_DISPOSABLE_MIGRATIONS);
  await rejectEnvFiles();
  temporary = await mkdtemp(join(tmpdir(), 'testimonial-e2e-'));
  const apiWorkDir = join(temporary, 'workspace/apps/api');
  await mkdir(apiWorkDir, { recursive: true });
  await rm(join(webDir, '.e2e-results'), { recursive: true, force: true });
  await mkdir(join(webDir, '.e2e-results'), { recursive: true });
  console.log(`E2E ${runId}: prepare exclusive PostgreSQL 18 / Redis 7`);
  await docker('Create owned network', [
    'network',
    'create',
    '--label',
    `${ownerLabel}=${runId}`,
    networkName,
  ]);
  networkCreated = true;
  for (const kind of ['pg', 'redis']) {
    const dataPath = kind === 'pg' ? '/var/lib/postgresql' : '/data';
    const containerPort = kind === 'pg' ? '5432' : '6379';
    const args = [
      'run',
      '--detach',
      '--name',
      resourceName(runId, kind),
      '--label',
      `${ownerLabel}=${runId}`,
      '--network',
      networkName,
      '--publish',
      `127.0.0.1::${containerPort}`,
      '--tmpfs',
      `${dataPath}:rw`,
      ...(kind === 'pg'
        ? [
            '--env',
            `POSTGRES_DB=e2e_${runId}`,
            '--env',
            'POSTGRES_HOST_AUTH_METHOD=trust',
          ]
        : []),
      images[kind],
      ...(kind === 'pg'
        ? ['-c', 'shared_preload_libraries=pg_stat_statements']
        : ['redis-server', '--save', '', '--appendonly', 'no']),
    ];
    await docker('Create disposable service', args);
    created.push(kind);
  }
  const pgOptions = {
    runId,
    kind: 'pg',
    port: '5432/tcp',
    dataPath: '/var/lib/postgresql',
  };
  const redisOptions = {
    runId,
    kind: 'redis',
    port: '6379/tcp',
    dataPath: '/data',
  };
  const pgPort = validateContainer(await inspect('pg'), pgOptions);
  validateContainer(await inspect('redis'), redisOptions);
  await waitFor(
    'PostgreSQL',
    async () =>
      (await docker('Probe PostgreSQL', [
        'exec',
        resourceName(runId, 'pg'),
        'pg_isready',
        '-h',
        '127.0.0.1',
        '-U',
        'postgres',
        '-d',
        `e2e_${runId}`,
      ])) !== '',
  );
  await waitFor(
    'Redis',
    async () =>
      (await docker('Probe Redis', [
        'exec',
        resourceName(runId, 'redis'),
        'redis-cli',
        'ping',
      ])) === 'PONG',
  );
  const migrationEnv = {
    ...env,
    DATABASE_URL: `postgresql://postgres@127.0.0.1:${pgPort}/e2e_${runId}?schema=public`,
  };
  // Reinspect immediately before migrating. There is no user-supplied destination.
  validateContainer(await inspect('pg'), pgOptions);
  await command(
    'Migrate owned disposable DB',
    process.execPath,
    [
      join(root, 'node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--schema',
      join(root, 'apps/api/prisma/schema.prisma'),
    ],
    { cwd: apiWorkDir, env: migrationEnv, timeout: 120_000 },
  );

  console.log(
    `E2E ${runId}: build production API image and start real application`,
  );
  await docker('Build production API', [
    'build',
    '--target',
    'runner',
    '--label',
    `${ownerLabel}=${runId}`,
    '--tag',
    imageName,
    '--file',
    'apps/api/Dockerfile',
    '.',
  ]);
  imageCreated = true;
  const apiEnv = {
    ...env,
    PORT: '4000',
    DATABASE_URL: `postgresql://postgres@${resourceName(runId, 'pg')}:5432/e2e_${runId}?schema=public`,
    REDIS_URL: `redis://${resourceName(runId, 'redis')}:6379`,
    JWT_SECRET: randomBytes(48).toString('base64url'),
    API_KEY_PEPPERS_JSON: JSON.stringify({
      1: randomBytes(32).toString('base64url'),
    }),
    WEBHOOK_SECRET_KEYS_JSON: JSON.stringify({
      1: randomBytes(32).toString('base64url'),
    }),
    TRUST_PROXY_HOPS: '0',
    OTEL_SDK_DISABLED: 'true',
    BI_OPERATIONS_ENABLED: 'false',
  };
  const httpsPort = await freePort();
  const baseURL = `https://127.0.0.1:${httpsPort}`;
  apiEnv.CORS_ORIGIN = baseURL;
  await docker(
    'Start production API',
    [
      'run',
      '--detach',
      '--name',
      resourceName(runId, 'api'),
      '--label',
      `${ownerLabel}=${runId}`,
      '--network',
      networkName,
      '--publish',
      '127.0.0.1::4000',
      '--read-only',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      ...Object.keys(apiEnv)
        .filter((key) => !Object.hasOwn(env, key) || key === 'NODE_ENV')
        .flatMap((key) => ['--env', key]),
      imageName,
    ],
    { env: apiEnv },
  );
  created.push('api');
  const apiPort = validateContainer(await inspect('api'), {
    runId,
    kind: 'api',
    port: '4000/tcp',
  });
  await waitFor('API readiness', () =>
    healthy(`http://127.0.0.1:${apiPort}/api/v1/health/ready`),
  );

  console.log(
    `E2E ${runId}: build Next.js with same-origin proxy and serve HTTPS`,
  );
  const webPort = await freePort();
  const webEnv = {
    ...env,
    NEXT_PUBLIC_API_URL: '/api/v1',
    API_BACKEND_ORIGIN: `http://127.0.0.1:${apiPort}`,
  };
  await command(
    'Build production web',
    'npm',
    ['run', 'build', '--workspace', '@testimonial-cms/web'],
    { env: webEnv },
  );
  const standalone = join(webDir, '.next/standalone/apps/web');
  await cp(join(webDir, '.next/static'), join(standalone, '.next/static'), {
    recursive: true,
  });
  await cp(join(webDir, 'public'), join(standalone, 'public'), {
    recursive: true,
  });
  const web = start(process.execPath, [join(standalone, 'server.js')], {
    env: { ...webEnv, PORT: String(webPort), HOSTNAME: '127.0.0.1' },
  });
  web.stdout.resume();
  await waitFor(
    'Next.js',
    () => healthy(`http://127.0.0.1:${webPort}/admin/login`),
    () => web.exitCode === null && web.signalCode === null,
  );
  const keyPath = join(temporary, 'localhost.key');
  const certPath = join(temporary, 'localhost.crt');
  await command(
    'Generate ephemeral TLS certificate',
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '1',
      '-subj',
      '/CN=127.0.0.1',
      '-addext',
      'subjectAltName=IP:127.0.0.1',
      '-keyout',
      keyPath,
      '-out',
      certPath,
    ],
    { timeout: 15_000 },
  );
  // mkdtemp is mode 0700; certificate/key are deleted in finally, never evidence.
  front = httpsServer(
    { key: await readFile(keyPath), cert: await readFile(certPath) },
    (req, res) => {
      const upstream = httpRequest(
        {
          host: '127.0.0.1',
          port: webPort,
          path: req.url,
          method: req.method,
          headers: req.headers,
        },
        (response) => {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        },
      );
      upstream.setTimeout(30_000, () => upstream.destroy());
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });
      req.on('aborted', () => upstream.destroy());
      req.pipe(upstream);
    },
  );
  await new Promise((res, rej) => {
    front.once('error', rej);
    front.listen(httpsPort, '127.0.0.1', res);
  });
  await waitFor('HTTPS same-origin API', () =>
    healthy(`${baseURL}/api/v1/health/ready`, true),
  );
  const head = await command('Identify checkout', 'git', ['rev-parse', 'HEAD']);
  const dirty =
    (await command('Identify local changes', 'git', [
      'status',
      '--porcelain',
    ])) !== '';
  await writeFile(
    join(webDir, '.e2e-results/environment.json'),
    JSON.stringify(
      {
        runId,
        startedAt,
        head,
        dirty,
        node: process.version,
        images,
        api: 'production Dockerfile runner',
        web: 'production standalone',
        transport: 'local HTTPS, same-origin proxy',
        externalProviders: 'not exercised',
        retries: 0,
      },
      null,
      2,
    ),
  );
  console.log(`E2E ${runId}: run Chromium desktop/mobile (no suite retries)`);
  await command(
    'Playwright critical journeys',
    process.execPath,
    [join(root, 'node_modules/@playwright/test/cli.js'), 'test'],
    {
      cwd: webDir,
      env: {
        ...env,
        NODE_ENV: 'test',
        E2E_BASE_URL: baseURL,
        E2E_MANAGED_RUN: runId,
      },
      timeout: 360_000,
    },
  );
  console.log(
    `E2E ${runId}: PASS; sanitized evidence in apps/web/.e2e-results`,
  );
} catch (error) {
  // Only harness-authored messages; never print service output, request bodies or env.
  console.error(
    error instanceof Error &&
      (error.message.startsWith('E2E') ||
        error.message.includes('failed (') ||
        error.message.includes('timeout'))
      ? error.message
      : 'E2E preparation or integrity check failed; inspect the documented prerequisites',
  );
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
