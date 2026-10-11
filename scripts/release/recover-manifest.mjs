import {
  mkdtempSync,
  readFileSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { github, fail, repository } from './qualify.mjs';
import { digestPattern, command } from './providers.mjs';

export async function recoverManifest(
  env,
  get = (path) => github(path, env),
  runCommand = command,
) {
  if (!/^\d+$/.test(env.SOURCE_RUN_ID ?? ''))
    fail('RELEASE_SOURCE_RUN_INVALID');
  const run = await get(`actions/runs/${env.SOURCE_RUN_ID}`);
  if (
    run.path !== '.github/workflows/demo-release.yml' ||
    run.conclusion !== 'success' ||
    run.head_sha !== env.RELEASE_SHA ||
    !['push', 'workflow_dispatch'].includes(run.event)
  )
    fail('RELEASE_SOURCE_RUN_NOT_SUCCESSFUL');
  const artifacts = await get(
    `actions/runs/${env.SOURCE_RUN_ID}/artifacts?per_page=100`,
  );
  const artifact = artifacts.artifacts.find(
    (item) =>
      item.name === 'demo-release-evidence' &&
      !item.expired &&
      item.size_in_bytes <= 1048576,
  );
  if (!artifact) fail('RELEASE_EVIDENCE_EXPIRED');
  const directory = mkdtempSync(join(tmpdir(), 'demo-recovery-'));
  try {
    runCommand(
      'gh',
      [
        'run',
        'download',
        env.SOURCE_RUN_ID,
        '--repo',
        repository,
        '--name',
        'demo-release-evidence',
        '--dir',
        directory,
      ],
      { env },
    );
    const manifest = JSON.parse(
      readFileSync(join(directory, 'manifest.json'), 'utf8'),
    );
    if (
      manifest.version !== 1 ||
      manifest.repository !== repository ||
      manifest.sha !== env.RELEASE_SHA ||
      manifest.tag !== env.RELEASE_TAG ||
      manifest.runId !== Number(env.SOURCE_RUN_ID) ||
      !digestPattern.test(manifest.apiDigest ?? '') ||
      !digestPattern.test(manifest.maintenanceDigest ?? '') ||
      !manifest.vercelDeploymentUrl
    )
      fail('RELEASE_RECOVERY_MANIFEST_MISMATCH');
    return manifest;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const manifest = await recoverManifest(process.env);
    mkdirSync('release-evidence', { recursive: true });
    writeFileSync(
      'release-evidence/manifest.json',
      JSON.stringify(manifest, null, 2) + '\n',
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'release.recovery_rejected',
        code: /^RELEASE_[A-Z_]+$/.test(error.message)
          ? error.message
          : 'RELEASE_RECOVERY_FAILED',
      }),
    );
    process.exitCode = 1;
  }
}
