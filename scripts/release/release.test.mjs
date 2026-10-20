import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { qualify, repository } from './qualify.mjs';
import {
  deliver,
  configuration,
  railwayDeploy,
  workerProbe,
  verifyDeployment,
  verifyVercel,
  command,
  health,
} from './providers.mjs';
import { migrationPlan } from './migrate.mjs';
import { recoverManifest } from './recover-manifest.mjs';
import { collectTools } from './collect-maintenance-tools.mjs';

const sha = 'a'.repeat(40);
const digest = `sha256:${'b'.repeat(64)}`;
const uuid = (number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const base = {
  GITHUB_REPOSITORY: repository,
  GITHUB_EVENT_NAME: 'push',
  GITHUB_REF: 'refs/tags/v0.1.0',
  DEMO_DELIVERY_ENABLED: 'true',
};
const provider = {
  ...base,
  RELEASE_SHA: sha,
  DEMO_SCHEMA_READY_SHA: sha,
  DEMO_PROVIDER_PREFLIGHT_COMPLETE: 'true',
  RAILWAY_PROJECT_ID: uuid(1),
  RAILWAY_ENVIRONMENT_ID: uuid(2),
  RAILWAY_API_SERVICE_ID: uuid(3),
  RAILWAY_WORKER_SERVICE_ID: uuid(4),
  VERCEL_PROJECT_ID: 'prj_fixture',
  VERCEL_ORG_ID: 'team_fixture',
  API_BACKEND_ORIGIN: 'https://fixture.up.railway.app',
  DEMO_WEB_ORIGIN: 'https://fixture.vercel.app',
  RAILWAY_TOKEN: 'fixture',
  RAILWAY_SSH_PRIVATE_KEY: 'synthetic-only',
  RAILWAY_SSH_KNOWN_HOSTS: 'ssh.railway.com ssh-ed25519 Zml4dHVyZQ==',
  VERCEL_TOKEN: 'fixture',
};
const manifest = {
  version: 1,
  repository,
  sha,
  tag: 'v0.1.0',
  runId: 123,
  apiDigest: digest,
  maintenanceDigest: digest,
  railway: Object.fromEntries(
    ['api', 'worker'].map((role) => [
      role,
      JSON.parse(readFileSync(`infra/railway/${role}.json`, 'utf8')).deploy,
    ]),
  ),
};

function api(overrides = {}) {
  const values = {
    ref: { object: { type: 'tag', sha } },
    annotation: { object: { type: 'commit', sha } },
    main: { protected: true, commit: { sha } },
    comparison: { status: 'identical' },
    runs: {
      workflow_runs: [
        {
          id: 7,
          run_number: 2,
          run_attempt: 1,
          head_sha: sha,
          head_branch: 'main',
          event: 'push',
          status: 'completed',
          conclusion: 'success',
        },
      ],
    },
    jobs: {
      total_count: 3,
      jobs: [
        { name: 'verify', conclusion: 'success' },
        { name: 'secret-scan', conclusion: 'success' },
        { name: 'dependency-review', conclusion: 'skipped' },
      ],
    },
    environment: {
      protection_rules: [
        { type: 'required_reviewers', reviewers: [{ type: 'Team', id: 1 }] },
      ],
      deployment_branch_policy: { custom_branch_policies: true },
    },
    policies: {
      branch_policies: [
        { type: 'tag', name: 'v*' },
        { type: 'branch', name: 'main' },
      ],
    },
    ...overrides,
  };
  return async (path) => {
    if (path.startsWith('git/ref/')) return values.ref;
    if (path.startsWith('git/tags/')) return values.annotation;
    if (path === 'branches/main') return values.main;
    if (path.startsWith('compare/')) return values.comparison;
    if (path.startsWith('actions/workflows/')) return values.runs;
    if (path.startsWith('actions/runs/')) return values.jobs;
    if (path.endsWith('/deployment-branch-policies')) return values.policies;
    if (path.startsWith('environments/')) return values.environment;
    throw new Error('Unexpected fixture request');
  };
}

test('delivery remains disabled with no GitHub or cloud call', async () => {
  let calls = 0;
  await assert.rejects(
    qualify({ ...base, DEMO_DELIVERY_ENABLED: '' }, async () => {
      calls++;
    }),
    /RELEASE_NOT_ARMED/,
  );
  assert.equal(calls, 0);
});

test('qualifies an annotated main commit with successful push CI and reviewers', async () => {
  assert.deepEqual(await qualify(base, api()), {
    sha,
    tag: 'v0.1.0',
    ciRunId: 7,
    ciRunAttempt: 1,
    environment: 'demo',
  });
});

for (const [name, override, code] of [
  [
    'lightweight tag',
    { ref: { object: { type: 'commit', sha } } },
    'ANNOTATED_TAG_REQUIRED',
  ],
  [
    'unprotected main',
    { main: { protected: false, commit: { sha } } },
    'MAIN_UNPROTECTED',
  ],
  [
    'commit outside main',
    { comparison: { status: 'diverged' } },
    'COMMIT_NOT_ON_MAIN',
  ],
  [
    'red CI',
    {
      runs: {
        workflow_runs: [
          {
            id: 7,
            run_number: 2,
            head_sha: sha,
            event: 'push',
            head_branch: 'main',
            status: 'completed',
            conclusion: 'failure',
          },
        ],
      },
    },
    'MAIN_CI_NOT_GREEN',
  ],
  [
    'missing gate',
    {
      jobs: {
        total_count: 1,
        jobs: [{ name: 'verify', conclusion: 'success' }],
      },
    },
    'CI_GATE_MISSING',
  ],
  [
    'no reviewers',
    { environment: { protection_rules: [] } },
    'APPROVAL_REQUIRED',
  ],
  [
    'unrestricted environment',
    {
      environment: {
        protection_rules: [{ type: 'required_reviewers', reviewers: [1] }],
      },
    },
    'ENVIRONMENT_REFS_UNRESTRICTED',
  ],
  [
    'tag forbidden by environment',
    { policies: { branch_policies: [{ type: 'branch', name: 'main' }] } },
    'ENVIRONMENT_REF_NOT_ALLOWED',
  ],
])
  test(`rejects ${name}`, async () => {
    await assert.rejects(
      qualify(base, api(override)),
      new RegExp(`RELEASE_${code}`),
    );
  });

test('rejects latest failed CI even when an older run passed', async () => {
  const runs = {
    workflow_runs: [
      {
        id: 8,
        run_number: 3,
        head_sha: sha,
        event: 'push',
        head_branch: 'main',
        status: 'completed',
        conclusion: 'failure',
      },
      {
        id: 7,
        run_number: 2,
        head_sha: sha,
        event: 'push',
        head_branch: 'main',
        status: 'completed',
        conclusion: 'success',
      },
    ],
  };
  await assert.rejects(
    qualify(base, api({ runs })),
    /RELEASE_MAIN_CI_NOT_GREEN/,
  );
});

test('manual controller must run on main and a build must attest its actual source SHA', async () => {
  const env = {
    ...base,
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    RELEASE_TAG: 'v0.1.0',
  };
  await assert.rejects(qualify(env, api()), /RELEASE_CONTROLLER_MUST_BE_MAIN/);
  await assert.rejects(
    qualify(
      {
        ...env,
        GITHUB_REF: 'refs/heads/main',
        RELEASE_BUILD: 'true',
        GITHUB_SHA: 'c'.repeat(40),
      },
      api(),
    ),
    /RELEASE_BUILD_SOURCE_MISMATCH/,
  );
  assert.equal(
    (
      await qualify(
        {
          ...env,
          GITHUB_REF: 'refs/heads/main',
          RELEASE_BUILD: 'true',
          GITHUB_SHA: sha,
        },
        api(),
      )
    ).sha,
    sha,
  );
});

test('rejects shell-like tag input before any read', async () => {
  await assert.rejects(
    qualify({ ...base, GITHUB_REF: 'refs/tags/v0.1.0;other' }, api()),
    /RELEASE_TAG_INVALID/,
  );
});

function transport(failAt) {
  const events = [];
  const step = (name) => {
    events.push(name);
    if (failAt === name) throw new Error('Fixture failure');
  };
  return {
    events,
    adapters: {
      checkProject: async () => step('project'),
      checkWebEnv: () => step('web-env'),
      checkDeployment: async () => step('candidate-identity'),
      deploy: async (_env, service) => {
        step(service === provider.RAILWAY_API_SERVICE_ID ? 'api' : 'worker');
        return { id: uuid(9) };
      },
      checkWorker: () => step('heartbeat'),
      checkHealth: async (origin) =>
        step(
          origin === provider.API_BACKEND_ORIGIN
            ? 'api-health'
            : 'canonical-health',
        ),
      run: (_bin, args) => {
        const operation = args[0];
        step(
          operation === 'project'
            ? 'inspect'
            : operation === 'curl'
              ? args[1] === '/api/v1/health/ready'
                ? 'proxy-health'
                : 'metrics'
              : operation,
        );
        if (operation === 'deploy') return 'https://candidate.vercel.app';
        if (operation === 'curl')
          return args[1] === '/api/v1/health/ready' ? '{"status":"ok"}' : '404';
        return '';
      },
    },
  };
}

test('promotes only after API, worker heartbeat, candidate identity and proxy checks', async () => {
  const { events, adapters } = transport();
  assert.equal(
    await deliver(provider, manifest, adapters),
    'https://candidate.vercel.app',
  );
  assert.deepEqual(events, [
    'project',
    'api',
    'api-health',
    'worker',
    'heartbeat',
    'inspect',
    'pull',
    'web-env',
    'build',
    'deploy',
    'candidate-identity',
    'proxy-health',
    'metrics',
    'promote',
    'canonical-health',
  ]);
});

for (const failAt of [
  'project',
  'api',
  'api-health',
  'worker',
  'heartbeat',
  'inspect',
  'pull',
  'web-env',
  'build',
  'deploy',
  'candidate-identity',
  'proxy-health',
  'metrics',
]) {
  test(`does not promote after ${failAt} failure`, async () => {
    const { events, adapters } = transport(failAt);
    await assert.rejects(deliver(provider, manifest, adapters));
    assert.equal(events.includes('promote'), false);
  });
}

test('recovery reuses the recorded image and web deployment without a new build', async () => {
  const { events, adapters } = transport();
  await deliver(
    { ...provider, RECOVERY: 'true', DEMO_ROLLBACK_COMPATIBLE_SHA: sha },
    { ...manifest, vercelDeploymentUrl: 'https://previous.vercel.app' },
    adapters,
  );
  for (const name of ['pull', 'build', 'deploy'])
    assert.equal(events.includes(name), false);
  assert.equal(events.includes('promote'), true);
});

test('rejects missing schema approval, tokens, shared services and insecure destinations', () => {
  for (const patch of [
    { DEMO_SCHEMA_READY_SHA: '' },
    { RAILWAY_TOKEN: '' },
    { RAILWAY_WORKER_SERVICE_ID: provider.RAILWAY_API_SERVICE_ID },
    { API_BACKEND_ORIGIN: 'http://fixture.up.railway.app' },
    { DEMO_WEB_ORIGIN: 'https://fixture.vercel.app/other' },
    { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    { RAILWAY_SSH_KNOWN_HOSTS: 'other.example ssh-ed25519 Zml4dHVyZQ==' },
  ]) {
    assert.throws(() => configuration({ ...provider, ...patch }, sha));
  }
});

test('rejects service config containing implicit migration before provider calls', async () => {
  const { events, adapters } = transport();
  await assert.rejects(
    deliver(
      provider,
      {
        ...manifest,
        railway: {
          ...manifest.railway,
          api: { ...manifest.railway.api, preDeployCommand: ['migrate'] },
        },
      },
      adapters,
    ),
    /RELEASE_SERVICE_CONFIG_INVALID/,
  );
  assert.deepEqual(events, []);
});

test('failed async worker probe blocks the web and promotion', async () => {
  const { events, adapters } = transport();
  adapters.checkWorker = async () => {
    throw new Error('Fixture heartbeat failure');
  };
  await assert.rejects(deliver(provider, manifest, adapters));
  assert.equal(events.includes('build'), false);
  assert.equal(events.includes('promote'), false);
});

for (const [path, response] of [
  ['/api/v1/health/ready', '{"status":"unavailable"}'],
  ['/api/v1/internal/metrics', '200'],
])
  test(`proxy ${path} unexpected response blocks promotion`, async () => {
    const { events, adapters } = transport();
    const run = adapters.run;
    adapters.run = (bin, args) => {
      const value = run(bin, args);
      return args[0] === 'curl' && args[1] === path ? response : value;
    };
    await assert.rejects(deliver(provider, manifest, adapters));
    assert.equal(events.includes('promote'), false);
  });

test('existing Vercel project must own the expected domain before linking', async () => {
  const project = {
    id: provider.VERCEL_PROJECT_ID,
    accountId: provider.VERCEL_ORG_ID,
    rootDirectory: 'apps/web',
    framework: 'nextjs',
  };
  await assert.rejects(
    verifyVercel(provider, async (url) => ({
      ok: true,
      json: async () =>
        url.includes('/domains?')
          ? { domains: [{ name: 'different.vercel.app' }] }
          : project,
    })),
    /RELEASE_VERCEL_DOMAIN_MISMATCH/,
  );
});

test('tracks the newly submitted Railway deployment by exact ID and image', async () => {
  let reads = 0;
  const image = `ghcr.io/${repository.toLowerCase()}/api@${digest}`;
  const old = { id: uuid(10), status: 'SUCCESS', meta: { image: 'old' } };
  const candidate = { id: uuid(11), status: 'BUILDING', meta: { image } };
  const run = (_bin, args) =>
    args[0] === 'environment'
      ? '{}'
      : JSON.stringify(
          ++reads === 1
            ? [old]
            : reads === 2
              ? [candidate, old]
              : [{ ...candidate, status: 'SUCCESS' }, old],
        );
  const result = await railwayDeploy(
    provider,
    provider.RAILWAY_API_SERVICE_ID,
    image,
    { run, wait: async () => {} },
  );
  assert.equal(result.id, candidate.id);
});

for (const status of ['FAILED', 'CRASHED', 'NEEDS_APPROVAL', 'SKIPPED'])
  test(`rejects Railway ${status}`, async () => {
    const image = `ghcr.io/${repository.toLowerCase()}/api@${digest}`;
    let reads = 0;
    await assert.rejects(
      railwayDeploy(provider, provider.RAILWAY_API_SERVICE_ID, image, {
        run: (_bin, args) =>
          args[0] === 'environment'
            ? '{}'
            : JSON.stringify(
                ++reads === 1
                  ? []
                  : [{ id: uuid(11), status, meta: { image } }],
              ),
        wait: async () => {},
      }),
      /RELEASE_RAILWAY_DEPLOYMENT_FAILED/,
    );
  });

test('rejects ambiguous Railway submissions and a mismatched digest', async () => {
  const image = `ghcr.io/${repository.toLowerCase()}/api@${digest}`;
  for (const candidates of [
    [{ id: uuid(11) }, { id: uuid(12) }],
    [{ id: uuid(11), meta: { image: 'different' } }],
  ]) {
    let reads = 0;
    await assert.rejects(
      railwayDeploy(provider, provider.RAILWAY_API_SERVICE_ID, image, {
        run: (_bin, args) =>
          args[0] === 'environment'
            ? '{}'
            : JSON.stringify(++reads === 1 ? [] : candidates),
        wait: async () => {},
      }),
    );
  }
});

test('worker probe is valid JavaScript, checks its deployment ID and uses bounded read-only SQL', () => {
  let code;
  let identity;
  workerProbe(
    provider,
    { id: uuid(9), createdAt: '2026-10-11T12:00:00Z' },
    (_bin, args, options) => {
      assert.equal(args.includes(provider.RAILWAY_WORKER_SERVICE_ID), true);
      identity = args[args.indexOf('--identity-file') + 1];
      assert.equal(existsSync(identity), true);
      assert.match(
        readFileSync(options.env.DEMO_SSH_CONFIG, 'utf8'),
        /StrictHostKeyChecking yes/,
      );
      code = options.input;
    },
  );
  const checked = spawnSync(
    process.execPath,
    ['--input-type=module', '--check'],
    { input: code, encoding: 'utf8' },
  );
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(code, /RAILWAY_DEPLOYMENT_ID/);
  assert.match(code, /SET TRANSACTION READ ONLY/);
  assert.match(code, /protocol_version=1/);
  assert.equal(existsSync(identity), false);
});

test('Vercel candidate identity must match project, source SHA and production target', async () => {
  const result = {
    projectId: provider.VERCEL_PROJECT_ID,
    meta: { releaseSha: sha },
    readyState: 'READY',
    target: 'production',
  };
  await verifyDeployment(
    provider,
    'https://candidate.vercel.app',
    sha,
    async () => ({ ok: true, json: async () => result }),
  );
  await assert.rejects(
    verifyDeployment(
      provider,
      'https://candidate.vercel.app',
      sha,
      async () => ({
        ok: true,
        json: async () => ({ ...result, projectId: 'prj_other' }),
      }),
    ),
    /RELEASE_VERCEL_DEPLOYMENT_MISMATCH/,
  );
  await assert.rejects(
    health(provider.API_BACKEND_ORIGIN, async () => ({ ok: false })),
    /RELEASE_HEALTH_FAILED/,
  );
});

test('worker probe removes ephemeral SSH credentials after a provider failure', () => {
  let identity;
  assert.throws(() =>
    workerProbe(
      provider,
      { id: uuid(9), createdAt: '2026-10-11T12:00:00Z' },
      (_bin, args) => {
        identity = args[args.indexOf('--identity-file') + 1];
        throw new Error('Fixture SSH failure');
      },
    ),
  );
  assert.equal(existsSync(identity), false);
});

test('subprocesses do not inherit unrelated provider credentials', () => {
  const result = command(
    process.execPath,
    [
      '-e',
      "console.log(['RAILWAY_TOKEN','RAILWAY_SSH_PRIVATE_KEY','VERCEL_TOKEN','GH_TOKEN'].some(name=>Boolean(process.env[name])))",
    ],
    { env: { ...process.env, ...provider, GH_TOKEN: 'fixture' } },
  );
  assert.equal(result, 'false');
});

const temporary = mkdtempSync(join(tmpdir(), 'release-fixture-'));
execFileSync(
  'openssl',
  [
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-days',
    '1',
    '-keyout',
    join(temporary, 'key'),
    '-out',
    join(temporary, 'cert'),
    '-subj',
    '/CN=localhost',
  ],
  { stdio: 'ignore' },
);
after(() => rmSync(temporary, { force: true, recursive: true }));
const cert = readFileSync(join(temporary, 'cert'), 'utf8');
function migrationEnv(target) {
  const hosts = {
    OLTP: 'db.fixtureoltp.supabase.co',
    WAREHOUSE: 'db.fixturedw.supabase.co',
  };
  const url = new URL(
    `postgresql://${target === 'oltp' ? hosts.OLTP : hosts.WAREHOUSE}/postgres`,
  );
  url.username = target === 'oltp' ? 'cms_migrator' : 'bi_migrator';
  url.password = 'synthetic-only';
  return {
    DEMO_MIGRATIONS_ENABLED: 'true',
    SUPABASE_OLTP_HOST: hosts.OLTP,
    SUPABASE_WAREHOUSE_HOST: hosts.WAREHOUSE,
    OLTP_CA_PEM: cert,
    WAREHOUSE_CA_PEM: cert,
    MIGRATION_DATABASE_URL: url.toString(),
  };
}
for (const target of ['oltp', 'warehouse'])
  test(`plans ${target} migration only with explicit ACK, migrator role and strict TLS`, () => {
    const env = migrationEnv(target);
    assert.throws(
      () => migrationPlan(env, target, sha, ''),
      /RELEASE_MIGRATION_ACK_REQUIRED/,
    );
    assert.throws(
      () =>
        migrationPlan(
          { ...env, DEMO_MIGRATIONS_ENABLED: '' },
          target,
          sha,
          `APPLY ${sha} ${target}`,
        ),
      /RELEASE_MIGRATION_ACK_REQUIRED/,
    );
    const plan = migrationPlan(env, target, sha, `APPLY ${sha} ${target}`);
    const parsed = new URL(
      plan.env[
        target === 'oltp' ? 'DATABASE_URL' : 'BI_MIGRATION_DATABASE_URL'
      ],
    );
    const ca = parsed.searchParams.get('sslcert');
    assert.equal(parsed.searchParams.get('connection_limit'), '1');
    assert.equal(parsed.searchParams.get('sslaccept'), 'strict');
    assert.ok(existsSync(ca));
    plan.cleanup();
    assert.equal(existsSync(ca), false);
    const wrong = new URL(env.MIGRATION_DATABASE_URL);
    wrong.username = 'postgres';
    assert.throws(
      () =>
        migrationPlan(
          { ...env, MIGRATION_DATABASE_URL: wrong.toString() },
          target,
          sha,
          `APPLY ${sha} ${target}`,
        ),
      /DEMO_DATABASE_URL_INVALID/,
    );
  });

test('recovery accepts only a successful release with matching immutable manifest', async () => {
  const env = {
    RELEASE_SHA: sha,
    RELEASE_TAG: manifest.tag,
    SOURCE_RUN_ID: '123',
  };
  const get = async (path) =>
    path.endsWith('/123')
      ? {
          path: '.github/workflows/demo-release.yml',
          conclusion: 'success',
          head_sha: sha,
          event: 'push',
        }
      : {
          artifacts: [
            {
              name: 'demo-release-evidence',
              size_in_bytes: 100,
              expired: false,
            },
          ],
        };
  const result = await recoverManifest(env, get, (_bin, args) => {
    writeFileSync(
      join(args.at(-1), 'manifest.json'),
      JSON.stringify({
        ...manifest,
        vercelDeploymentUrl: 'https://previous.vercel.app',
      }),
    );
  });
  assert.equal(result.apiDigest, digest);
  await assert.rejects(
    recoverManifest(env, async () => ({ conclusion: 'failure' })),
    /RELEASE_SOURCE_RUN_NOT_SUCCESSFUL/,
  );
});

test('all delivery workflows serialize together, pin actions and preserve manual migrations', () => {
  const require = createRequire(import.meta.url);
  const { parse } = require('yaml');
  for (const name of ['demo-release', 'demo-recover', 'demo-migrate']) {
    const workflow = parse(
      readFileSync(`.github/workflows/${name}.yml`, 'utf8'),
    );
    assert.equal(workflow.concurrency.group, 'demo-delivery');
    assert.equal(workflow.concurrency['cancel-in-progress'], false);
    for (const job of Object.values(workflow.jobs)) {
      assert.ok(job['timeout-minutes']);
      for (const step of job.steps)
        if (step.uses) assert.match(step.uses, /@[a-f0-9]{40}$/);
    }
    if (name === 'demo-release')
      assert.deepEqual(workflow.on.push.tags, ['v*']);
    else assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch']);
    if (name === 'demo-migrate') {
      assert.equal(workflow.jobs.migrate.environment, 'demo-migrations');
      assert.ok(
        workflow.jobs.migrate['runs-on'].includes('demo-maintenance-ipv6'),
      );
    }
  }
});

test('maintenance tool closure preserves nested versions and excludes unrelated development tools', () => {
  const root = mkdtempSync(join(tmpdir(), 'maintenance-closure-'));
  const output = join(root, 'output');
  const pkg = (path, value) => {
    mkdirSync(join(root, path), { recursive: true });
    writeFileSync(join(root, path, 'package.json'), JSON.stringify(value));
  };
  try {
    pkg('node_modules/prisma', {
      name: 'prisma',
      dependencies: { engine: '1' },
      optionalDependencies: { absent: '1' },
      peerDependencies: { typescript: '1' },
      peerDependenciesMeta: { typescript: { optional: true } },
    });
    pkg('node_modules/engine', {
      name: 'engine',
      version: '1',
      dependencies: { shared: '2' },
    });
    pkg('node_modules/engine/node_modules/shared', {
      name: 'shared',
      version: '2',
    });
    pkg('node_modules/shared', { name: 'shared', version: '1' });
    pkg('node_modules/typescript', { name: 'typescript' });
    pkg('node_modules/supabase', { name: 'supabase' });
    const copied = collectTools(root, output);
    assert.deepEqual(copied, [
      'node_modules/engine',
      'node_modules/engine/node_modules/shared',
      'node_modules/prisma',
    ]);
    assert.equal(
      JSON.parse(
        readFileSync(
          join(output, 'node_modules/engine/node_modules/shared/package.json'),
        ),
      ).version,
      '2',
    );
    assert.equal(existsSync(join(output, 'node_modules/supabase')), false);
    rmSync(join(root, 'node_modules/engine'), { recursive: true });
    assert.throws(
      () => collectTools(root, output),
      /MAINTENANCE_DEPENDENCY_MISSING/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('statistics warehouse migration is separately explicit and preserves the default target', () => {
  const env = migrationEnv('warehouse');
  const baseline = migrationPlan(
    env,
    'warehouse',
    sha,
    `APPLY ${sha} warehouse`,
  );
  try {
    assert.equal(baseline.args.at(-1), '0004_bi_operations.sql');
  } finally {
    baseline.cleanup();
  }
  const statistics = migrationPlan(
    { ...env, DEMO_BI_STATISTICS_MIGRATION: 'true' },
    'warehouse',
    sha,
    `APPLY ${sha} warehouse statistics`,
  );
  try {
    assert.equal(statistics.args.at(-1), '0005_bi_statistics.sql');
  } finally {
    statistics.cleanup();
  }
  assert.throws(
    () =>
      migrationPlan(
        { ...env, DEMO_BI_STATISTICS_MIGRATION: 'true' },
        'warehouse',
        sha,
        `APPLY ${sha} warehouse`,
      ),
    /RELEASE_MIGRATION_ACK_REQUIRED/,
  );
  assert.throws(
    () =>
      migrationPlan(
        { ...env, DEMO_BI_STATISTICS_MIGRATION: 'invalid' },
        'warehouse',
        sha,
        `APPLY ${sha} warehouse`,
      ),
    /RELEASE_MIGRATION_TARGET_INVALID/,
  );
});
