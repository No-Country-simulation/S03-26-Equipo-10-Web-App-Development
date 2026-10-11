import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { fail, shaPattern, repository } from './qualify.mjs';

export const digestPattern = /^sha256:[a-f0-9]{64}$/;
const uuidPattern = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
export function configuration(env, sha) {
  if (!shaPattern.test(sha) || env.DEMO_DELIVERY_ENABLED !== 'true')
    fail('RELEASE_NOT_ARMED');
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') fail('RELEASE_TLS_REQUIRED');
  const compatible =
    env.RECOVERY === 'true'
      ? env.DEMO_ROLLBACK_COMPATIBLE_SHA === sha
      : env.DEMO_SCHEMA_READY_SHA === sha;
  if (!compatible || env.DEMO_PROVIDER_PREFLIGHT_COMPLETE !== 'true')
    fail('RELEASE_PROVIDER_PREFLIGHT_REQUIRED');
  for (const name of [
    'RAILWAY_PROJECT_ID',
    'RAILWAY_ENVIRONMENT_ID',
    'RAILWAY_API_SERVICE_ID',
    'RAILWAY_WORKER_SERVICE_ID',
  ]) {
    if (!uuidPattern.test(env[name] ?? ''))
      fail('RELEASE_RAILWAY_TARGET_INVALID');
  }
  if (env.RAILWAY_API_SERVICE_ID === env.RAILWAY_WORKER_SERVICE_ID)
    fail('RELEASE_SERVICES_MUST_DIFFER');
  if (
    !/^prj_[a-zA-Z0-9]+$/.test(env.VERCEL_PROJECT_ID ?? '') ||
    !/^team_[a-zA-Z0-9]+$/.test(env.VERCEL_ORG_ID ?? '')
  )
    fail('RELEASE_VERCEL_TARGET_INVALID');
  for (const name of ['API_BACKEND_ORIGIN', 'DEMO_WEB_ORIGIN']) {
    let url;
    try {
      url = new URL(env[name]);
    } catch {
      fail('RELEASE_ORIGIN_INVALID');
    }
    const suffix =
      name === 'API_BACKEND_ORIGIN' ? '.up.railway.app' : '.vercel.app';
    if (
      url.protocol !== 'https:' ||
      !url.hostname.endsWith(suffix) ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      fail('RELEASE_ORIGIN_INVALID');
  }
  for (const name of [
    'RAILWAY_TOKEN',
    'VERCEL_TOKEN',
    'RAILWAY_SSH_PRIVATE_KEY',
  ])
    if (!env[name]) fail('RELEASE_PROVIDER_TOKEN_REQUIRED');
  if (!validSshHosts(env.RAILWAY_SSH_KNOWN_HOSTS))
    fail('RELEASE_SSH_HOST_REQUIRED');
  return env;
}

function validSshHosts(value) {
  const lines = value?.trim().split('\n');
  return (
    lines?.length &&
    lines.every((line) =>
      /^ssh\.railway\.com (?:ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256) [A-Za-z0-9+/]+={0,2}$/.test(
        line.trim(),
      ),
    )
  );
}

/** Capture provider output in memory; never persist raw logs, project env files or exception messages. */
export function command(
  bin,
  args,
  { input, env = process.env, timeout = 300000 } = {},
) {
  const executionEnv = { ...env };
  for (const name of [
    'RAILWAY_TOKEN',
    'RAILWAY_SSH_PRIVATE_KEY',
    'VERCEL_TOKEN',
    'GH_TOKEN',
  ])
    delete executionEnv[name];
  if (bin === 'railway') executionEnv.RAILWAY_TOKEN = env.RAILWAY_TOKEN;
  if (bin === 'vercel') executionEnv.VERCEL_TOKEN = env.VERCEL_TOKEN;
  if (bin === 'gh') executionEnv.GH_TOKEN = env.GH_TOKEN;
  const result = spawnSync(bin, args, {
    env: {
      ...executionEnv,
      CI: 'true',
      NO_COLOR: '1',
      VERCEL_TELEMETRY_DISABLED: '1',
      RAILWAY_CALLER: 'skill:use-railway@1.6.1',
      RAILWAY_AGENT_SESSION: `demo-release-${env.GITHUB_RUN_ID ?? 'manual'}`,
    },
    input,
    encoding: 'utf8',
    timeout,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0)
    fail('RELEASE_PROVIDER_COMMAND_FAILED');
  return result.stdout.trim();
}

export function imageReference(kind, digest) {
  if (!['api', 'maintenance'].includes(kind) || !digestPattern.test(digest))
    fail('RELEASE_IMAGE_INVALID');
  return `ghcr.io/${repository.toLowerCase()}/${kind}@${digest}`;
}

export async function railwayDeploy(
  env,
  service,
  image,
  {
    run = command,
    wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    record = () => {},
    config,
  } = {},
) {
  if (
    !uuidPattern.test(service) ||
    !/^ghcr\.io\/[a-z0-9_/-]+@sha256:[a-f0-9]{64}$/.test(image)
  )
    fail('RELEASE_IMAGE_INVALID');
  const selectors = [
    '--project',
    env.RAILWAY_PROJECT_ID,
    '--environment',
    env.RAILWAY_ENVIRONMENT_ID,
  ];
  const list = () =>
    JSON.parse(
      run(
        'railway',
        [
          'deployment',
          'list',
          ...selectors,
          '--service',
          service,
          '--limit',
          '100',
          '--json',
        ],
        { env },
      ),
    );
  const previous = list();
  const before = new Set(previous.map((item) => item.id));
  let deployment =
    previous[0]?.meta?.image === image && previous[0].status === 'SUCCESS'
      ? previous[0]
      : undefined;
  if (!deployment) {
    if (previous[0]?.meta?.image === image) {
      // A deliberate new workflow run may retry a known terminal failure, never an uncertain live deployment.
      if (
        !['FAILED', 'CRASHED', 'REMOVED', 'SKIPPED'].includes(
          previous[0].status,
        )
      )
        fail('RELEASE_EXISTING_DEPLOYMENT_NOT_TERMINAL');
      run(
        'railway',
        [
          'redeploy',
          ...selectors,
          '--service',
          service,
          '--from-source',
          '--yes',
          '--json',
        ],
        { env },
      );
    } else {
      run(
        'railway',
        [
          'environment',
          'edit',
          ...selectors,
          '--message',
          `Release ${env.RELEASE_SHA}`,
          '--json',
        ],
        {
          env,
          input: JSON.stringify({
            services: {
              [service]: {
                source: { image, autoUpdates: { type: 'disabled' } },
                deploy: config,
              },
            },
          }),
        },
      );
    }
  }
  for (let attempt = 0; attempt < 120; attempt++) {
    const all = list();
    if (!deployment) {
      const fresh = all.filter((item) => !before.has(item.id));
      if (fresh.length > 1) fail('RELEASE_DEPLOYMENT_AMBIGUOUS');
      if (fresh.length === 1) {
        deployment = fresh[0];
        // Docker-image deployments expose meta.image in the pinned Railway CLI contract.
        if (deployment.meta?.image !== image)
          fail('RELEASE_DEPLOYED_IMAGE_MISMATCH');
        record({
          service,
          deploymentId: deployment.id,
          image,
          status: deployment.status,
        });
      }
    }
    const current = deployment && all.find((item) => item.id === deployment.id);
    if (current?.status === 'SUCCESS') {
      record({
        service,
        deploymentId: current.id,
        image,
        status: current.status,
      });
      return current;
    }
    if (
      current &&
      ['FAILED', 'CRASHED', 'REMOVED', 'SKIPPED', 'NEEDS_APPROVAL'].includes(
        current.status,
      )
    )
      fail('RELEASE_RAILWAY_DEPLOYMENT_FAILED');
    await wait(5000);
  }
  fail('RELEASE_RAILWAY_DEPLOYMENT_TIMEOUT');
}

export async function health(origin, fetcher = fetch) {
  const response = await fetcher(`${origin}/api/v1/health/ready`, {
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
    cache: 'no-store',
  });
  if (!response.ok || (await response.json()).status !== 'ok')
    fail('RELEASE_HEALTH_FAILED');
}

export async function verifyVercel(env, fetcher = fetch) {
  const response = await fetcher(
    `https://api.vercel.com/v9/projects/${env.VERCEL_PROJECT_ID}?teamId=${env.VERCEL_ORG_ID}`,
    {
      headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` },
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    },
  );
  if (!response.ok) fail('RELEASE_VERCEL_PROJECT_LOOKUP_FAILED');
  const project = await response.json();
  if (
    project.id !== env.VERCEL_PROJECT_ID ||
    project.accountId !== env.VERCEL_ORG_ID ||
    project.rootDirectory !== 'apps/web' ||
    project.framework !== 'nextjs'
  )
    fail('RELEASE_VERCEL_PROJECT_MISMATCH');
  const domainsResponse = await fetcher(
    `https://api.vercel.com/v9/projects/${env.VERCEL_PROJECT_ID}/domains?teamId=${env.VERCEL_ORG_ID}`,
    {
      headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` },
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    },
  );
  if (
    !domainsResponse.ok ||
    !(await domainsResponse.json()).domains?.some(
      (domain) => domain.name === new URL(env.DEMO_WEB_ORIGIN).hostname,
    )
  )
    fail('RELEASE_VERCEL_DOMAIN_MISMATCH');
  mkdirSync('.vercel', { recursive: true });
  writeFileSync(
    '.vercel/project.json',
    JSON.stringify({ projectId: project.id, orgId: project.accountId }),
    { mode: 0o600 },
  );
}

export async function verifyDeployment(env, candidate, sha, fetcher = fetch) {
  const response = await fetcher(
    `https://api.vercel.com/v13/deployments/${new URL(candidate).hostname}?teamId=${env.VERCEL_ORG_ID}`,
    {
      headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` },
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    },
  );
  if (!response.ok) fail('RELEASE_VERCEL_DEPLOYMENT_LOOKUP_FAILED');
  const deployment = await response.json();
  if (
    deployment.projectId !== env.VERCEL_PROJECT_ID ||
    deployment.meta?.releaseSha !== sha ||
    deployment.readyState !== 'READY' ||
    deployment.target !== 'production'
  )
    fail('RELEASE_VERCEL_DEPLOYMENT_MISMATCH');
}

export function verifyWebEnvironment(env) {
  const pulled = parseEnv(
    readFileSync('.vercel/.env.production.local', 'utf8'),
  );
  if (
    pulled.NEXT_PUBLIC_API_URL !== '/api/v1' ||
    pulled.API_BACKEND_ORIGIN !== env.API_BACKEND_ORIGIN
  )
    fail('RELEASE_WEB_ENVIRONMENT_MISMATCH');
}

export function workerProbe(env, deployment, run = command) {
  if (
    !env.RAILWAY_SSH_PRIVATE_KEY ||
    !validSshHosts(env.RAILWAY_SSH_KNOWN_HOSTS)
  )
    fail('RELEASE_SSH_CREDENTIALS_REQUIRED');
  const cutoff = new Date(
    Date.parse(deployment.createdAt) - 5000,
  ).toISOString();
  const heartbeatSql =
    "SELECT EXISTS(SELECT 1 FROM etl.worker_health WHERE protocol_version=1 AND NOT stopping AND last_seen_at > clock_timestamp()-interval '60 seconds' AND started_at >= $1::timestamptz) AS ready";
  const code = `import {createRequire} from 'node:module';
import {prepareEnvironment} from '/app/scripts/demo/config.mjs';
if(process.env.RAILWAY_DEPLOYMENT_ID!==${JSON.stringify(deployment.id)}) process.exit(1);
const prepared=prepareEnvironment('worker',process.env);
const {PrismaClient}=createRequire('/app/package.json')('@prisma/client');
const client=new PrismaClient({datasources:{db:{url:prepared.env.BI_ETL_DATABASE_URL}},log:[]});
try { const rows=await client.$transaction(async tx=>{
 await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
 await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5s'");
 return tx.$queryRawUnsafe(${JSON.stringify(heartbeatSql)},${JSON.stringify(cutoff)});
},{timeout:10000,maxWait:1000}); if(rows[0]?.ready!==true)process.exitCode=1;
} catch {process.exitCode=1;} finally {await client.$disconnect();prepared.cleanup();}`;
  const directory = mkdtempSync(join(tmpdir(), 'demo-worker-ssh-'));
  const identity = join(directory, 'identity');
  const knownHosts = join(directory, 'known_hosts');
  const config = join(directory, 'config');
  try {
    writeFileSync(identity, env.RAILWAY_SSH_PRIVATE_KEY + '\n', {
      mode: 0o600,
    });
    writeFileSync(knownHosts, env.RAILWAY_SSH_KNOWN_HOSTS.trim() + '\n', {
      mode: 0o600,
    });
    writeFileSync(
      config,
      `Host *\n  BatchMode yes\n  IdentitiesOnly yes\n  StrictHostKeyChecking yes\n  UserKnownHostsFile ${JSON.stringify(knownHosts)}\n`,
      { mode: 0o600 },
    );
    // Railway's native SSH subprocess has no option passthrough; force a dedicated config without changing ~/.ssh.
    writeFileSync(
      join(directory, 'ssh'),
      '#!/bin/sh\nexec /usr/bin/ssh -F "$DEMO_SSH_CONFIG" "$@"\n',
      { mode: 0o700 },
    );
    run(
      'railway',
      [
        'ssh',
        '--project',
        env.RAILWAY_PROJECT_ID,
        '--environment',
        env.RAILWAY_ENVIRONMENT_ID,
        '--service',
        env.RAILWAY_WORKER_SERVICE_ID,
        '--identity-file',
        identity,
        '--',
        'node',
        '--input-type=module',
      ],
      {
        env: {
          ...env,
          DEMO_SSH_CONFIG: config,
          PATH: `${directory}:${env.PATH ?? process.env.PATH}`,
        },
        input: code,
        timeout: 30000,
      },
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

export async function deliver(
  env,
  manifest,
  {
    run = command,
    deploy = railwayDeploy,
    checkHealth = health,
    checkProject = verifyVercel,
    checkWorker = workerProbe,
    checkDeployment = verifyDeployment,
    checkWebEnv = verifyWebEnvironment,
    record = () => {},
  } = {},
) {
  configuration(env, manifest.sha);
  for (const role of ['api', 'worker']) {
    const config = manifest.railway?.[role];
    const allowed = new Set([
      'numReplicas',
      'sleepApplication',
      'startCommand',
      'healthcheckPath',
      'healthcheckTimeout',
      'restartPolicyType',
      'restartPolicyMaxRetries',
      'overlapSeconds',
      'drainingSeconds',
    ]);
    if (
      !config ||
      Object.keys(config).some((key) => !allowed.has(key)) ||
      config.numReplicas !== 1 ||
      config.sleepApplication !== false ||
      config.startCommand !== `node scripts/demo/runtime.mjs ${role}` ||
      config.healthcheckPath !==
        (role === 'api' ? '/api/v1/health/ready' : null) ||
      config.restartPolicyType !== 'ON_FAILURE' ||
      config.overlapSeconds !== 0 ||
      config.drainingSeconds !== 330
    )
      fail('RELEASE_SERVICE_CONFIG_INVALID');
  }
  const image = imageReference('api', manifest.apiDigest);
  await checkProject(env); // Prove the existing target before any provider mutation.
  await deploy(env, env.RAILWAY_API_SERVICE_ID, image, {
    run,
    record,
    config: manifest.railway.api,
  });
  await checkHealth(env.API_BACKEND_ORIGIN);
  const worker = await deploy(env, env.RAILWAY_WORKER_SERVICE_ID, image, {
    run,
    record,
    config: manifest.railway.worker,
  });
  await checkWorker(env, worker, run);
  record({ phase: 'backend-ready' });
  const scope = ['--scope', env.VERCEL_ORG_ID, '--non-interactive'];
  run('vercel', ['project', 'inspect', ...scope], { env });
  let candidate = manifest.vercelDeploymentUrl;
  if (!candidate) {
    run('vercel', ['pull', '--yes', '--environment=production', ...scope], {
      env,
    });
    await checkWebEnv(env);
    run('vercel', ['build', '--prod', ...scope], {
      env: { ...env, NEXT_PUBLIC_API_URL: '/api/v1' },
      timeout: 1200000,
    });
    candidate = run(
      'vercel',
      [
        'deploy',
        '--prebuilt',
        '--prod',
        '--skip-domain',
        '--yes',
        ...scope,
        '--meta',
        `releaseSha=${manifest.sha}`,
      ],
      { env, timeout: 600000 },
    );
  }
  if (!/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(candidate))
    fail('RELEASE_VERCEL_DEPLOYMENT_INVALID');
  await checkDeployment(env, candidate, manifest.sha);
  record({ phase: 'web-candidate', vercelDeploymentUrl: candidate });
  const ready = run(
    'vercel',
    ['curl', '/api/v1/health/ready', '--deployment', candidate, ...scope],
    { env },
  );
  if (JSON.parse(ready).status !== 'ok')
    fail('RELEASE_WEB_PROXY_HEALTH_FAILED');
  const metrics = run(
    'vercel',
    [
      'curl',
      '/api/v1/internal/metrics',
      '--deployment',
      candidate,
      ...scope,
      '--',
      '--silent',
      '--output',
      '/dev/null',
      '--write-out',
      '%{http_code}',
    ],
    { env },
  );
  if (metrics !== '404') fail('RELEASE_INTERNAL_PROXY_EXPOSED');
  run(
    'vercel',
    ['promote', candidate, '--yes', '--timeout', '180s', ...scope],
    { env },
  );
  await checkHealth(env.DEMO_WEB_ORIGIN);
  record({ phase: 'promoted', vercelDeploymentUrl: candidate });
  return candidate;
}
