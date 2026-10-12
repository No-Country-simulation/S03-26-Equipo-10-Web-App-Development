import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveImages, smokeImages, requireSmoke } from './image-smoke.mjs';
import { repository } from './qualify.mjs';
import { publishImages } from './publish.mjs';

const sha = 'a'.repeat(40);
const ids = {
  api: `sha256:${'b'.repeat(64)}`,
  maintenance: `sha256:${'c'.repeat(64)}`,
};
function fixture(failStep, change = () => {}) {
  const calls = [];
  const run = (cmd, args, options) => {
    calls.push({ cmd, args, options });
    if (cmd === 'docker') {
      const kind = args[2].includes('/maintenance:') ? 'maintenance' : 'api';
      const image = {
        Id: ids[kind],
        Config: {
          Labels: {
            'org.opencontainers.image.revision': sha,
            'org.opencontainers.image.source': `https://github.com/${repository}`,
          },
        },
      };
      change(image);
      return JSON.stringify([image]);
    }
    if (cmd === failStep) throw new Error('synthetic smoke failure');
    return '';
  };
  return { run, calls };
}
test('prueba los IDs exactos de maintenance y API antes de emitir evidencia', () => {
  const { run, calls } = fixture();
  const report = smokeImages(sha, run);
  assert.equal(report.complete, true);
  assert.ok(
    calls.some((c) => c.cmd === 'bash' && c.args.includes(ids.maintenance)),
  );
  assert.ok(
    calls.some((c) => c.cmd === process.execPath && c.args.includes(ids.api)),
  );
  assert.equal(requireSmoke(report, sha, resolveImages(sha, run)), report);
  assert.equal(
    calls.some((c) => c.args.includes('push')),
    false,
  );
});
for (const step of ['bash', process.execPath])
  test('un smoke fallido no genera aceptación: ' + step, () => {
    const { run } = fixture(step);
    assert.throws(() => smokeImages(sha, run), /synthetic smoke failure/);
  });
test('rechaza una imagen construida de otro commit', () => {
  const { run } = fixture(undefined, (image) => {
    image.Config.Labels['org.opencontainers.image.revision'] = 'd'.repeat(40);
  });
  assert.throws(() => smokeImages(sha, run), /RELEASE_IMAGE_SOURCE_MISMATCH/);
});
for (const [name, alter] of [
  ['ausente', () => undefined],
  ['fallida', (r) => ({ ...r, complete: false })],
  ['SHA distinto', (r) => ({ ...r, sha: 'd'.repeat(40) })],
  [
    'API retaggeada',
    (r) => ({
      ...r,
      images: { ...r.images, api: { ...r.images.api, id: ids.maintenance } },
    }),
  ],
  ['maintenance omitida', (r) => ({ ...r, images: { api: r.images.api } })],
])
  test(`bloquea publicación con evidencia ${name}`, () => {
    const { run } = fixture();
    const report = {
      version: 1,
      complete: true,
      sha,
      images: resolveImages(sha, run),
    };
    assert.throws(
      () => requireSmoke(alter(report), sha, resolveImages(sha, run)),
      /RELEASE_IMAGE_SMOKE_REQUIRED/,
    );
  });

for (const [name, report] of [
  ['ausente', undefined],
  ['fallida', { version: 1, complete: false, sha }],
  ['de otro SHA', { version: 1, complete: true, sha: 'e'.repeat(40) }],
])
  test(`el publicador no hace push con evidencia ${name}`, () => {
    const { run, calls } = fixture();
    assert.throws(
      () =>
        publishImages(
          {
            RELEASE_SHA: sha,
            RELEASE_TAG: 'v0.1.0',
            DEMO_DELIVERY_ENABLED: 'true',
          },
          run,
          () => report,
        ),
      /RELEASE_IMAGE_SMOKE_REQUIRED/,
    );
    assert.equal(
      calls.some((c) => c.args.includes('push')),
      false,
    );
  });

test('el publicador rechaza una imagen reemplazada después del smoke antes del primer push', () => {
  const original = fixture();
  const report = {
    version: 1,
    complete: true,
    sha,
    images: resolveImages(sha, original.run),
  };
  const changed = fixture(undefined, (image) => {
    if (image.Id === ids.maintenance) image.Id = `sha256:${'d'.repeat(64)}`;
  });
  assert.throws(
    () =>
      publishImages(
        {
          RELEASE_SHA: sha,
          RELEASE_TAG: 'v0.1.0',
          DEMO_DELIVERY_ENABLED: 'true',
        },
        changed.run,
        () => report,
      ),
    /RELEASE_IMAGE_SMOKE_REQUIRED/,
  );
  assert.equal(
    changed.calls.some((c) => c.args.includes('push')),
    false,
  );
});

test('publica sólo después de validar ambas imágenes y conserva los digests recuperables', () => {
  const { run: inspect } = fixture();
  const report = {
    version: 1,
    complete: true,
    sha,
    images: resolveImages(sha, inspect),
  };
  const calls = [];
  const run = (cmd, args) => {
    calls.push(args);
    if (args[0] === 'image') return inspect(cmd, args);
    if (args[0] === 'inspect') {
      const tag = args.at(-1);
      return JSON.stringify([`${tag.split(':')[0]}@${ids.api}`]);
    }
    return '';
  };
  const manifest = publishImages(
    { RELEASE_SHA: sha, RELEASE_TAG: 'v0.1.0', DEMO_DELIVERY_ENABLED: 'true' },
    run,
    () => report,
  );
  assert.equal(
    calls.findIndex((args) => args[0] === 'push'),
    2,
  );
  assert.equal(calls.filter((args) => args[0] === 'push').length, 2);
  assert.equal(manifest.apiDigest, ids.api);
  assert.equal(manifest.maintenanceDigest, ids.api);
});
