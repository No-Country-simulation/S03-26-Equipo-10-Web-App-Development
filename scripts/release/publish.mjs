import {
  appendFileSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from 'node:fs';
import { command, digestPattern } from './providers.mjs';
import { fail, repository, shaPattern, versionPattern } from './qualify.mjs';

try {
  const env = process.env;
  if (
    !shaPattern.test(env.RELEASE_SHA ?? '') ||
    !versionPattern.test(env.RELEASE_TAG ?? '') ||
    env.DEMO_DELIVERY_ENABLED !== 'true'
  )
    fail('RELEASE_INPUT_INVALID');
  const manifest = {
    version: 1,
    repository,
    sha: env.RELEASE_SHA,
    tag: env.RELEASE_TAG,
    runId: Number(env.GITHUB_RUN_ID),
    ciRunId: Number(env.CI_RUN_ID),
    ciRunAttempt: Number(env.CI_RUN_ATTEMPT),
    railway: Object.fromEntries(
      ['api', 'worker'].map((role) => [
        role,
        JSON.parse(readFileSync(`infra/railway/${role}.json`, 'utf8')).deploy,
      ]),
    ),
  };
  for (const kind of ['api', 'maintenance']) {
    const name = `ghcr.io/${repository.toLowerCase()}/${kind}`;
    const tag = `${name}:sha-${manifest.sha}`;
    command('docker', ['push', tag]);
    const refs = JSON.parse(
      command('docker', ['inspect', '--format', '{{json .RepoDigests}}', tag]),
    );
    const digest = refs
      .find((ref) => ref.startsWith(`${name}@`))
      ?.slice(name.length + 1);
    if (!digestPattern.test(digest ?? ''))
      fail('RELEASE_PUBLISHED_DIGEST_MISSING');
    // Confirm registry retrieval by that exact content digest before attesting it.
    command('docker', ['buildx', 'imagetools', 'inspect', `${name}@${digest}`]);
    manifest[`${kind}Digest`] = digest;
    appendFileSync(
      env.GITHUB_OUTPUT,
      `${kind}_digest=${digest}\n${kind}_image=${name}\n`,
    );
  }
  mkdirSync('release-evidence', { recursive: true });
  writeFileSync(
    'release-evidence/manifest.json',
    JSON.stringify(manifest, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      event: 'release.images_published',
      sha: manifest.sha,
      apiDigest: manifest.apiDigest,
      maintenanceDigest: manifest.maintenanceDigest,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      event: 'release.publish_failed',
      code: /^RELEASE_[A-Z_]+$/.test(error.message)
        ? error.message
        : 'RELEASE_PUBLISH_FAILED',
    }),
  );
  process.exitCode = 1;
}
