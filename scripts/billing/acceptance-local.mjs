/** Opt-in local acceptance. Creates its own PG18/Redis7; accepts no service URLs or secrets. */
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  rm,
  cp,
  stat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as tcpServer } from 'node:net';
import { createServer as tlsServer, get as tlsGet } from 'node:https';
import { request as httpRequest, get as httpGet } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';
import { request } from '@playwright/test';
import { assertMigrationConsent } from '../e2e/managed.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const regression = process.argv.includes('--regression');
const apiChecks = process.argv.includes('--api-checks');
const allowed = regression
  ? ['--run', '--regression']
  : apiChecks
    ? ['--run', '--api-checks']
    : ['--run'];
if (JSON.stringify(process.argv.slice(2)) !== JSON.stringify(allowed))
  throw Error('BILLING_ACCEPTANCE_EXPLICIT_RUN_REQUIRED');
assertMigrationConsent(process.env.E2E_ALLOW_DISPOSABLE_MIGRATIONS);
const baseEnv = Object.fromEntries(
  ['PATH', 'HOME', 'TMPDIR', 'LANG']
    .filter((k) => process.env[k] !== undefined)
    .map((k) => [k, process.env[k]]),
);
const runId = randomBytes(6).toString('hex');
const children = new Set();
let temporary, front, pg, redis, db, redisClient, owner, temporaryConfig;
let interrupted = false;
const output = join(
  root,
  'apps/web/.e2e-results',
  ...(apiChecks ? ['billing-api'] : regression ? [] : ['billing']),
);
function start(exe, args, env = baseEnv, cwd = root) {
  const child = spawn(exe, args, {
    env,
    cwd,
    stdio: ['ignore', 'pipe', 'ignore'],
    detached: true,
  });
  children.add(child);
  child.once('close', () => children.delete(child));
  child.once('error', () => {
    child.failed = true;
  });
  child.stdout.resume();
  return child;
}
async function command(
  label,
  exe,
  args,
  env = baseEnv,
  cwd = root,
  timeout = 600000,
) {
  if (interrupted) throw Error('BILLING_ACCEPTANCE_INTERRUPTED');
  if (!['Probe PostgreSQL', 'Head', 'Changes'].includes(label))
    console.log(`BILLING ${runId}: ${label}`);
  const c = start(exe, args, env, cwd);
  let result = '';
  c.stdout.removeAllListeners('data');
  c.stdout.on('data', (d) => {
    if (result.length < 1000000) result += d;
  });
  const timer = setTimeout(() => terminate(c, 'SIGTERM'), timeout);
  try {
    return await new Promise((yes, no) => {
      c.once('error', () => no(Error(`${label}: executable unavailable`)));
      c.once('close', (code) => {
        if (label === 'Playwright acceptance')
          for (const line of result.split('\n')) {
            if (
              /^E2E failed at (fixtures\.ts|billing-desktop\.spec\.ts|billing-mobile\.spec\.ts):[0-9]+; sensitive diagnostics withheld$/.test(
                line,
              ) ||
              /^BILLING E2E [0-9]+\/[0-9]+; complete=(true|false)$/.test(
                line,
              ) ||
              /^E2E: [0-9]+\/[0-9]+ passed; complete=(true|false)$/.test(line)
            )
              console.log(line);
          }
        code === 0 ? yes(result.trim()) : no(Error(`${label}: failed`));
      });
    });
  } finally {
    clearTimeout(timer);
  }
}
async function port() {
  const s = tcpServer();
  await new Promise((ok, no) => {
    s.once('error', no);
    s.listen(0, '127.0.0.1', ok);
  });
  const p = s.address().port;
  await new Promise((ok) => s.close(ok));
  return p;
}
async function ready(label, probe, child) {
  const end = Date.now() + 60000;
  while (Date.now() < end && !interrupted) {
    if (
      child &&
      (child.failed || child.exitCode !== null || child.signalCode !== null)
    )
      throw Error(`${label}: process exited`);
    try {
      if (await probe()) return;
    } catch {}
    await delay(200);
  }
  throw Error(`${label}: readiness timeout`);
}
function healthy(url) {
  return new Promise((ok) => {
    const q = (url.startsWith('https:') ? tlsGet : httpGet)(
      url,
      { rejectUnauthorized: false, timeout: 1500 },
      (r) => {
        r.resume();
        ok(r.statusCode === 200);
      },
    );
    q.once('timeout', () => q.destroy());
    q.once('error', () => ok(false));
  });
}
function terminate(child, signal) {
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  terminate(child, 'SIGTERM');
  await Promise.race([
    new Promise((ok) => child.once('close', ok)),
    delay(10000),
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    terminate(child, 'SIGKILL');
    throw Error('BILLING_ACCEPTANCE_DRAIN_FAILED');
  }
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    interrupted = true;
    for (const c of children) terminate(c, 'SIGTERM');
  });
async function noEnvFiles() {
  for (const directory of [
    root,
    join(root, 'apps/api'),
    join(root, 'apps/api/prisma'),
    join(root, 'apps/web'),
  ])
    for (const name of [
      '.env',
      '.env.local',
      '.env.production',
      '.env.production.local',
    ]) {
      const exists = await stat(join(directory, name)).then(
        () => true,
        (e) => {
          if (e.code === 'ENOENT') return false;
          throw e;
        },
      );
      if (exists) throw Error('BILLING_ACCEPTANCE_REQUIRES_CLEAN_ENV_FILES');
    }
}
try {
  await noEnvFiles();
  await mkdir(output, { recursive: true });
  for (const filename of [
    'environment.json',
    'results.json',
    'failures.json',
    'api-regression.json',
  ])
    await rm(join(output, filename), { force: true });
  temporary = await mkdtemp(join(tmpdir(), 'billing-acceptance-'));
  await writeFile(join(temporary, 'owner'), runId, { mode: 0o600 });
  const redisExe = process.env.BILLING_E2E_REDIS_EXECUTABLE || 'redis-server';
  const redisVersion = await command('Redis version', redisExe, ['--version']);
  if (!/v=7\./.test(redisVersion))
    throw Error('BILLING_ACCEPTANCE_REDIS7_REQUIRED');
  const pgVersion = await command('PostgreSQL version', 'postgres', [
    '--version',
  ]);
  if (!/PostgreSQL\) 18\./.test(pgVersion))
    throw Error('BILLING_ACCEPTANCE_POSTGRES18_REQUIRED');
  const pgDir = join(temporary, 'pg'),
    redisDir = join(temporary, 'redis');
  await mkdir(redisDir);
  const [pgPort, redisPort, apiPort, webPort, httpsPort] = await Promise.all(
    Array.from({ length: 5 }, () => port()),
  );
  const origin = `https://127.0.0.1:${httpsPort}`,
    database = `billing_e2e_${runId}`;
  const databaseUrl = `postgresql://billing_e2e_owner@127.0.0.1:${pgPort}/${database}?schema=public&connection_limit=6`;
  console.log(
    `BILLING ${runId}: initialize owned PostgreSQL18/Redis7 (${regression ? 'regression' : 'local simulation'})`,
  );
  await command('Initialize PostgreSQL', 'initdb', [
    '-D',
    pgDir,
    '-U',
    'billing_e2e_owner',
    '--auth=trust',
  ]);
  pg = start('postgres', [
    '-D',
    pgDir,
    '-h',
    '127.0.0.1',
    '-p',
    String(pgPort),
    '-k',
    temporary,
    '-c',
    'max_connections=50',
  ]);
  await ready(
    'PostgreSQL',
    async () => {
      await command(
        'Probe PostgreSQL',
        'pg_isready',
        ['-h', '127.0.0.1', '-p', String(pgPort), '-U', 'billing_e2e_owner'],
        baseEnv,
        root,
        2000,
      );
      return true;
    },
    pg,
  );
  // Authenticate ownership before CREATE DATABASE as well as before migration.
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';
  db = new PrismaClient({ datasources: { db: { url: adminUrl.toString() } } });
  const [serverIdentity] =
    await db.$queryRaw`SELECT current_setting('data_directory') AS directory`;
  const postmasterId = (
    await readFile(join(pgDir, 'postmaster.pid'), 'utf8')
  ).split('\n')[0];
  if (
    serverIdentity.directory !== pgDir ||
    postmasterId !== String(pg.pid) ||
    pg.exitCode !== null ||
    (await readFile(join(temporary, 'owner'), 'utf8')) !== runId
  )
    throw Error('BILLING_ACCEPTANCE_OWNER_MISMATCH');
  await db.$disconnect();
  db = undefined;
  await command('Create own database', 'createdb', [
    '-h',
    '127.0.0.1',
    '-p',
    String(pgPort),
    '-U',
    'billing_e2e_owner',
    database,
  ]);
  db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const [identity] =
    await db.$queryRaw`SELECT current_setting('data_directory') AS directory,current_database() AS database`;
  if (
    identity.directory !== pgDir ||
    identity.database !== database ||
    (await readFile(join(temporary, 'owner'), 'utf8')) !== runId
  )
    throw Error('BILLING_ACCEPTANCE_OWNER_MISMATCH');
  redis = start(redisExe, [
    '--bind',
    '127.0.0.1',
    '--port',
    String(redisPort),
    '--save',
    '',
    '--appendonly',
    'no',
    '--dir',
    redisDir,
    '--protected-mode',
    'yes',
  ]);
  redisClient = createClient({
    url: `redis://127.0.0.1:${redisPort}`,
    socket: { reconnectStrategy: false },
  });
  redisClient.on('error', () => {});
  await ready(
    'Redis',
    async () => {
      if (!redisClient.isOpen) await redisClient.connect();
      return (await redisClient.ping()) === 'PONG';
    },
    redis,
  );
  const redisInfo = await redisClient.info('server');
  if (!redisInfo.includes(`process_id:${redis.pid}\r\n`))
    throw Error('BILLING_ACCEPTANCE_REDIS_OWNER_MISMATCH');
  await command(
    'Migrate own disposable database',
    process.execPath,
    [
      join(root, 'node_modules/prisma/build/index.js'),
      'migrate',
      'deploy',
      '--schema',
      join(root, 'apps/api/prisma/schema.prisma'),
    ],
    { ...baseEnv, DATABASE_URL: databaseUrl },
    temporary,
    120000,
  );
  const runtimeRole = `billing_e2e_runtime_${runId}`;
  await db.$executeRawUnsafe(`CREATE ROLE "${runtimeRole}" LOGIN`);
  await db.$executeRawUnsafe(
    `GRANT USAGE ON SCHEMA public TO "${runtimeRole}"`,
  );
  await db.$executeRawUnsafe(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${runtimeRole}"`,
  );
  await db.$executeRawUnsafe(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${runtimeRole}"`,
  );
  await db.$executeRawUnsafe(
    `REVOKE INSERT, UPDATE, DELETE ON billing_platform_operators FROM "${runtimeRole}"`,
  );
  await db.$executeRawUnsafe(
    `REVOKE UPDATE, DELETE ON billing_audit FROM "${runtimeRole}"`,
  );
  const runtimeUrl = databaseUrl.replace(
    'billing_e2e_owner@',
    `${runtimeRole}@`,
  );
  const runApiChecks = async () => {
    const testReport = join(temporary, 'api-results.json');
    let testsFailed = false;
    try {
      await command(
        'API regression',
        process.execPath,
        [
          join(root, 'node_modules/jest/bin/jest.js'),
          '--runInBand',
          '--json',
          '--outputFile',
          testReport,
        ],
        {
          ...baseEnv,
          NODE_ENV: 'test',
          TEST_DATABASE_URL: databaseUrl,
          TEST_LOGO_DATABASE_URL: databaseUrl,
          TEST_BILLING_DATABASE_URL: databaseUrl,
          TEST_REDIS_URL: `redis://127.0.0.1:${redisPort}`,
        },
        join(root, 'apps/api'),
        600000,
      );
    } catch {
      testsFailed = true;
    }
    const report = JSON.parse(await readFile(testReport, 'utf8'));
    const safe = {
      success: report.success,
      suites: {
        passed: report.numPassedTestSuites,
        failed: report.numFailedTestSuites,
        pending: report.numPendingTestSuites,
      },
      tests: {
        passed: report.numPassedTests,
        failed: report.numFailedTests,
        pending: report.numPendingTests,
      },
      failedFiles: report.testResults
        .filter((r) => r.status === 'failed')
        .map((r) => r.name.split('/').pop())
        .filter((n) => /^[a-z0-9.-]+\.spec\.ts$/.test(n)),
    };
    await writeFile(
      join(output, 'api-regression.json'),
      JSON.stringify(safe, null, 2),
    );
    console.log(
      `BILLING API regression: ${safe.tests.passed} passed, ${safe.tests.failed} failed, ${safe.tests.pending} pending`,
    );
    if (testsFailed || !safe.success)
      throw Error('BILLING_API_REGRESSION_FAILED');
  };
  if (apiChecks) {
    await runApiChecks();
  } else {
    await command(
      'Build API',
      'npm',
      ['run', 'build', '--workspace', 'apps/api'],
      { ...baseEnv, NODE_ENV: 'production' },
    );
    const billingConfig = {
      returnUrl: `${origin}/admin/billing/return`,
      simulationKey: randomBytes(32).toString('base64url'),
    };
    const apiEnv = {
      ...baseEnv,
      NODE_ENV: regression ? 'production' : 'test',
      PORT: String(apiPort),
      CORS_ORIGIN: origin,
      DATABASE_URL: runtimeUrl,
      REDIS_URL: `redis://127.0.0.1:${redisPort}`,
      JWT_SECRET: randomBytes(48).toString('base64url'),
      API_KEY_PEPPERS_JSON: JSON.stringify({
        1: randomBytes(32).toString('base64url'),
      }),
      WEBHOOK_SECRET_KEYS_JSON: JSON.stringify({
        1: randomBytes(32).toString('base64url'),
      }),
      METRICS_TOKEN: randomBytes(32).toString('base64url'),
      TRUST_PROXY_HOPS: '0',
      OTEL_SDK_DISABLED: 'true',
      BI_ENABLED: 'false',
      BI_OPERATIONS_ENABLED: 'false',
      BILLING_MODE: regression ? 'disabled' : 'simulation',
      ...(regression
        ? {}
        : { BILLING_CONFIG_JSON: JSON.stringify(billingConfig) }),
    };
    const apiArgs = [
      '--require',
      join(root, 'apps/api/dist/telemetry.js'),
      join(root, 'apps/api/dist/main.js'),
    ];
    let api = start(process.execPath, apiArgs, apiEnv);
    await ready(
      'API',
      () => healthy(`http://127.0.0.1:${apiPort}/api/v1/health/ready`),
      api,
    );
    let seed = {};
    if (!regression) {
      owner = await request.newContext({
        baseURL: `http://127.0.0.1:${apiPort}`,
        ignoreHTTPSErrors: true,
        extraHTTPHeaders: { Origin: origin, 'X-Auth-Mode': 'bearer' },
      });
      const credentials = {
        email: `billing-${randomUUID()}@example.invalid`,
        password: `Aa1!${randomBytes(24).toString('base64url')}`,
      };
      const registration = await owner.post('/api/v1/auth/register-admin', {
        data: { ...credentials, tenantName: `Billing acceptance ${runId}` },
      });
      if (registration.status() !== 201)
        throw Error('BILLING_ACCEPTANCE_REGISTER_FAILED');
      const session = (await registration.json()).data;
      await command(
        'Grant operator CLI',
        process.execPath,
        [
          join(root, 'apps/api/dist/modules/billing/operator.cli.js'),
          'grant',
          session.user.id,
          '--apply',
        ],
        { ...baseEnv, BILLING_OPERATOR_DATABASE_URL: databaseUrl },
      );
      const operator = await request.newContext({
        baseURL: `http://127.0.0.1:${apiPort}`,
        ignoreHTTPSErrors: true,
        extraHTTPHeaders: {
          Origin: origin,
          'X-Auth-Mode': 'bearer',
          Authorization: `Bearer ${session.tokens.accessToken}`,
        },
      });
      const write = async (path, data, status = 202) => {
        const res = await operator.post('/api/v1' + path, {
          data,
          headers: { 'Idempotency-Key': randomUUID() },
        });
        if (res.status() !== status)
          throw Error(
            `BILLING_ACCEPTANCE_SEED_CONTRACT ${path.replace(/[a-f0-9-]{36}/g, 'UUID')} expected=${status} actual=${res.status()}`,
          );
        return (await res.json()).data;
      };
      const accounts = {};
      for (const provider of ['stripe', 'mercadopago'])
        accounts[provider] = (
          await write('/platform/billing/accounts', {
            provider,
            sellerId: `synthetic-${provider}`,
            applicationId: null,
            configurationKey: 'BILLING_SIMULATION',
            enabled: true,
          })
        ).id;
      const plan = await write(
        '/platform/billing/plans',
        { code: `acceptance-${runId}` },
        201,
      );
      const version = await write(
        `/platform/billing/plans/${plan.id}/versions`,
        {
          name: 'Plan de aceptación local',
          description: 'Términos sintéticos para pruebas',
          trialDays: 14,
          graceDays: 7,
          features: {
            media: false,
            analytics: false,
            scoring: false,
            business_intelligence: false,
            bi_statistics: false,
            api_keys: true,
            webhooks: true,
          },
          quotas: {
            active_users: 1,
            stored_testimonials: 1,
            active_api_keys: 1,
            active_webhooks: 1,
          },
          prices: [
            {
              provider: 'stripe',
              currency: 'USD',
              interval: 'month',
              amountMinor: '1999',
              modes: ['manual', 'automatic'],
            },
            {
              provider: 'mercadopago',
              currency: 'ARS',
              interval: 'month',
              amountMinor: '1999900',
              modes: ['manual', 'automatic'],
            },
          ],
        },
        201,
      );
      await write(`/platform/billing/versions/${version.id}/publish`, {
        expectedRevision: Number(version.revision),
      });
      const catalog = (
        await (await operator.get('/api/v1/platform/billing/catalog')).json()
      ).data;
      const prices = catalog
        .find((p) => p.id === plan.id)
        .versions.find((v) => v.id === version.id).prices;
      for (const price of prices)
        await write('/platform/billing/sync', {
          accountId: accounts[price.provider],
          priceId: price.id,
        });
      const workerEnv = { ...apiEnv, BILLING_WORKER_DATABASE_URL: runtimeUrl };
      const tick = () =>
        command(
          'Financial worker CLI',
          process.execPath,
          [
            join(root, 'apps/api/dist/modules/billing/worker.cli.js'),
            '--once',
            session.user.id,
            '--apply',
          ],
          workerEnv,
        );
      await tick();
      // Restore the same owned process with durable ledger intact before any browser acceptance.
      await stop(api);
      api = start(process.execPath, apiArgs, apiEnv);
      await ready(
        'API restart',
        () => healthy(`http://127.0.0.1:${apiPort}/api/v1/health/ready`),
        api,
      );
      seed = {
        credentials,
        operatorToken: session.tokens.accessToken,
        actorId: session.user.id,
        accounts,
        planId: plan.id,
        versionId: version.id,
        prices,
      };
      await operator.dispose();
    }
    const webEnv = {
      ...baseEnv,
      NODE_ENV: 'production',
      NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_API_URL: '/api/v1',
      API_BACKEND_ORIGIN: `http://127.0.0.1:${apiPort}`,
    };
    await command(
      'Build web',
      'npm',
      ['run', 'build', '--workspace', 'apps/web'],
      webEnv,
    );
    const standalone = join(root, 'apps/web/.next/standalone/apps/web');
    await cp(
      join(root, 'apps/web/.next/static'),
      join(standalone, '.next/static'),
      { recursive: true },
    );
    await cp(join(root, 'apps/web/public'), join(standalone, 'public'), {
      recursive: true,
    });
    const web = start(process.execPath, [join(standalone, 'server.js')], {
      ...webEnv,
      PORT: String(webPort),
      HOSTNAME: '127.0.0.1',
    });
    await ready(
      'Web',
      () => healthy(`http://127.0.0.1:${webPort}/admin/login`),
      web,
    );
    const cert = join(temporary, 'localhost.crt'),
      key = join(temporary, 'localhost.key');
    await command('Ephemeral TLS', 'openssl', [
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
      key,
      '-out',
      cert,
    ]);
    front = tlsServer(
      { key: await readFile(key), cert: await readFile(cert) },
      (req, res) => {
        const up = httpRequest(
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
        up.setTimeout(30000, () => up.destroy());
        up.on('error', () => {
          if (!res.headersSent) res.writeHead(502);
          res.end();
        });
        req.on('aborted', () => up.destroy());
        req.pipe(up);
      },
    );
    await new Promise((ok, no) => {
      front.once('error', no);
      front.listen(httpsPort, '127.0.0.1', ok);
    });
    await ready('HTTPS', () => healthy(`${origin}/api/v1/health/ready`));
    await mkdir(output, { recursive: true });
    await writeFile(
      join(output, 'environment.json'),
      JSON.stringify(
        {
          runId,
          head: await command('Head', 'git', ['rev-parse', 'HEAD']),
          dirty:
            (await command('Changes', 'git', ['status', '--porcelain'])) !== '',
          node: process.version,
          postgres: pgVersion,
          redis: redisVersion,
          api: regression
            ? 'compiled NestJS production, billing disabled'
            : 'compiled NestJS test environment; billing simulation',
          web: 'Next production standalone',
          runtimeRole: 'DML, operators read-only, audit append-only',
          transport: 'local HTTPS same-origin proxy',
          externalProviders: 'not exercised',
          retries: 0,
        },
        null,
        2,
      ),
    );
    console.log(
      `BILLING ${runId}: browser acceptance; no intercepted app responses`,
    );
    let playwrightConfig = regression
      ? 'playwright.config.ts'
      : 'playwright.billing.config.ts';
    if (regression && process.env.BILLING_E2E_CHROME_EXECUTABLE) {
      playwrightConfig = join(
        root,
        `apps/web/.billing-regression-${runId}.config.ts`,
      );
      temporaryConfig = playwrightConfig;
      await writeFile(
        playwrightConfig,
        `import original from './playwright.config';\nexport default {...original, use:{...original.use, launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}}};\n`,
      );
    }
    await command(
      'Playwright acceptance',
      process.execPath,
      [
        join(root, 'node_modules/@playwright/test/cli.js'),
        'test',
        '--config',
        playwrightConfig,
      ],
      {
        ...baseEnv,
        NODE_ENV: 'test',
        PLAYWRIGHT_NO_COPY_PROMPT: '1',
        E2E_BASE_URL: origin,
        E2E_MANAGED_RUN: runId,
        ...(process.env.BILLING_E2E_CHROME_EXECUTABLE
          ? {
              BILLING_E2E_CHROME_EXECUTABLE:
                process.env.BILLING_E2E_CHROME_EXECUTABLE,
            }
          : {}),
        ...(regression
          ? {
              PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:
                process.env.BILLING_E2E_CHROME_EXECUTABLE,
            }
          : {
              BILLING_E2E_SEED: JSON.stringify(seed),
              BILLING_WORKER_DATABASE_URL: runtimeUrl,
              BILLING_CONFIG_JSON: apiEnv.BILLING_CONFIG_JSON,
              BILLING_MODE: 'simulation',
            }),
      },
      join(root, 'apps/web'),
      700000,
    );
    console.log(`BILLING ${runId}: PASS; sanitized evidence only`);
  }
} catch (error) {
  console.error(
    typeof error?.message === 'string' &&
      /^(BILLING|PostgreSQL|Redis|API|Web|HTTPS|Build|Migrate|Playwright|Financial|Grant|Ephemeral|Probe|Initialize|Create)/.test(
        error.message,
      )
      ? error.message
      : 'BILLING_ACCEPTANCE_FAILED',
  );
  process.exitCode = 1;
} finally {
  let failed = false;
  try {
    await owner?.dispose();
    await db?.$disconnect();
    if (redisClient?.isOpen) await redisClient.quit();
    if (front) await new Promise((ok) => front.close(ok));
  } catch {
    failed = true;
  }
  for (const c of [...children].reverse())
    try {
      await stop(c);
    } catch {
      failed = true;
    }
  if (temporary)
    try {
      if ((await readFile(join(temporary, 'owner'), 'utf8')) !== runId)
        throw Error('owner');
      await rm(temporary, { recursive: true });
    } catch {
      failed = true;
    }
  if (temporaryConfig) await rm(temporaryConfig, { force: true });
  if (failed) {
    console.error('BILLING_ACCEPTANCE_CLEANUP_FAILED');
    process.exitCode = 1;
  }
}
