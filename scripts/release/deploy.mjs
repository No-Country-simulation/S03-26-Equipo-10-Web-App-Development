import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { deliver, imageReference, command } from './providers.mjs';
import { fail, repository, qualify } from './qualify.mjs';

mkdirSync('release-evidence', { recursive: true });
const evidence = {
  version: 1,
  runId: process.env.GITHUB_RUN_ID,
  outcome: 'running',
  events: [],
};
const save = () =>
  writeFileSync(
    'release-evidence/deployment.json',
    JSON.stringify(evidence, null, 2) + '\n',
  );
try {
  const env = process.env;
  const manifest = JSON.parse(
    readFileSync('release-evidence/manifest.json', 'utf8'),
  );
  if (
    manifest.version !== 1 ||
    manifest.repository !== repository ||
    manifest.sha !== env.RELEASE_SHA ||
    manifest.tag !== env.RELEASE_TAG
  )
    fail('RELEASE_MANIFEST_MISMATCH');
  if (
    env.RECOVERY === 'true' &&
    (env.DEMO_ROLLBACK_COMPATIBLE_SHA !== manifest.sha ||
      !manifest.vercelDeploymentUrl)
  )
    fail('RELEASE_RECOVERY_COMPATIBILITY_REQUIRED');
  evidence.sha = manifest.sha;
  evidence.tag = manifest.tag;
  evidence.apiDigest = manifest.apiDigest;
  save();
  // Approval can wait; require current CI/protection again before mutating a provider.
  const qualified = await qualify(env);
  if (qualified.sha !== manifest.sha || qualified.tag !== manifest.tag)
    fail('RELEASE_MANIFEST_MISMATCH');
  evidence.validatedCiRunId = qualified.ciRunId;
  evidence.validatedCiRunAttempt = qualified.ciRunAttempt;
  save();
  command('gh', [
    'attestation',
    'verify',
    `oci://${imageReference('api', manifest.apiDigest)}`,
    '--repo',
    repository,
    '--signer-workflow',
    `${repository}/.github/workflows/demo-release.yml`,
    '--source-digest',
    manifest.sha,
    '--deny-self-hosted-runners',
  ]);
  const url = await deliver(env, manifest, {
    record: (event) => {
      evidence.events.push({ at: new Date().toISOString(), ...event });
      save();
    },
  });
  evidence.outcome = 'success';
  manifest.vercelDeploymentUrl = url;
  writeFileSync(
    'release-evidence/manifest.json',
    JSON.stringify(manifest, null, 2) + '\n',
  );
} catch (error) {
  evidence.outcome = 'failure';
  evidence.code = /^RELEASE_[A-Z_]+$/.test(error.message)
    ? error.message
    : 'RELEASE_DEPLOYMENT_FAILED';
  process.exitCode = 1;
} finally {
  save();
  // Vercel pull can materialize environment values. Never upload or retain them as evidence.
  rmSync('.vercel', { recursive: true, force: true });
  console.log(
    JSON.stringify({
      event: 'release.finished',
      sha: evidence.sha,
      outcome: evidence.outcome,
      code: evidence.code,
    }),
  );
}
