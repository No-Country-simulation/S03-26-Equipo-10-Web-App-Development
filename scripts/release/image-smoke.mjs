import { command } from './providers.mjs';
import { fail, repository, shaPattern } from './qualify.mjs';
import { digestPattern } from './providers.mjs';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function resolveImages(sha, run = command) {
  if (!shaPattern.test(sha ?? '')) fail('RELEASE_IMAGE_SOURCE_MISMATCH');
  return Object.fromEntries(
    ['api', 'maintenance'].map((kind) => {
      const tag = `ghcr.io/${repository.toLowerCase()}/${kind}:sha-${sha}`;
      const image = JSON.parse(run('docker', ['image', 'inspect', tag]))[0];
      if (
        !digestPattern.test(image?.Id ?? '') ||
        image.Config?.Labels?.['org.opencontainers.image.revision'] !== sha ||
        image.Config?.Labels?.['org.opencontainers.image.source'] !==
          `https://github.com/${repository}`
      )
        fail('RELEASE_IMAGE_SOURCE_MISMATCH');
      return [kind, { tag, id: image.Id }];
    }),
  );
}
export function smokeImages(sha, run = command) {
  const images = resolveImages(sha, run);
  run('bash', ['scripts/ci-smoke-maintenance.sh', images.maintenance.id], {
    timeout: 180_000,
  });
  run(process.execPath, ['scripts/e2e/run.mjs', '--api-smoke', images.api.id], {
    timeout: 300_000,
  });
  // Detect any tag replacement during smoke before recording acceptance.
  const report = { version: 1, complete: true, sha, images };
  requireSmoke(report, sha, resolveImages(sha, run));
  return report;
}
export function requireSmoke(report, sha, images) {
  if (report?.version !== 1 || report.complete !== true || report.sha !== sha)
    fail('RELEASE_IMAGE_SMOKE_REQUIRED');
  for (const kind of ['api', 'maintenance'])
    if (
      report.images?.[kind]?.id !== images[kind].id ||
      report.images?.[kind]?.tag !== images[kind].tag
    )
      fail('RELEASE_IMAGE_SMOKE_REQUIRED');
  return report;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const path = 'release-evidence/image-smoke.json';
  try {
    mkdirSync('release-evidence', { recursive: true });
    rmSync(path, { force: true }); // A previous success cannot survive a failed rerun.
    const report = smokeImages(process.env.RELEASE_SHA);
    writeFileSync(path, JSON.stringify(report, null, 2) + '\n');
    console.log(
      JSON.stringify({ event: 'release.images_smoked', sha: report.sha }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'release.image_smoke_failed',
        code: /^RELEASE_[A-Z_]+$/.test(error.message)
          ? error.message
          : 'RELEASE_IMAGE_SMOKE_FAILED',
      }),
    );
    process.exitCode = 1;
  }
}
