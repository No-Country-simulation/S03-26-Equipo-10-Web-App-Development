import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Resolve through the actual Jest consumer, independently of npm's hoisting.
const apiRequire = createRequire(
  new URL('../../apps/api/package.json', import.meta.url),
);
const jestRequire = createRequire(apiRequire.resolve('jest/package.json'));
const coreRequire = createRequire(
  jestRequire.resolve('@jest/core/package.json'),
);
const transformRequire = createRequire(
  coreRequire.resolve('@jest/transform/package.json'),
);
const pluginRequire = createRequire(
  transformRequire.resolve('babel-plugin-istanbul/package.json'),
);
const loaderRequire = createRequire(
  pluginRequire.resolve('@istanbuljs/load-nyc-config/package.json'),
);
const { loadNycConfig } = pluginRequire('@istanbuljs/load-nyc-config');

test('el lockfile no contiene sprintf-js ni referencias a esa dependencia', async () => {
  const lock = JSON.parse(
    await readFile(new URL('../../package-lock.json', import.meta.url), 'utf8'),
  );
  const vulnerable = Object.entries(lock.packages).filter(
    ([name, entry]) =>
      name.endsWith('/sprintf-js') ||
      entry.dependencies?.['sprintf-js'] ||
      entry.optionalDependencies?.['sprintf-js'],
  );
  assert.deepEqual(
    vulnerable.map(([name]) => name),
    [],
  );
});

test('el árbol instalado no contiene sprintf-js', async () => {
  const manifest = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  );
  const result = spawnSync('npm', ['ls', 'sprintf-js', '--all', '--json'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    timeout: 30000,
  });
  // npm ls returns 1 for an empty package selection, as well as for errors.
  assert.equal(result.error, undefined, 'npm ls must execute');
  assert.ok(result.status === 0 || result.status === 1, 'npm ls must complete');
  const tree = JSON.parse(result.stdout);
  assert.equal(tree.name, manifest.name, 'npm ls must identify this project');
  assert.equal(
    tree.error,
    undefined,
    'an npm error is not evidence of absence',
  );
  function visit(node) {
    assert.equal(
      node.problems,
      undefined,
      'invalid dependencies must not be hidden',
    );
    for (const [name, dependency] of Object.entries(node.dependencies ?? {})) {
      assert.notEqual(name, 'sprintf-js');
      visit(dependency);
    }
  }
  visit(tree);
});

test('el loader usado por Jest resuelve YAML 5.4.3 y argparse moderno', () => {
  assert.equal(loaderRequire('js-yaml/package.json').version, '5.4.3');
  const yamlRequire = createRequire(
    loaderRequire.resolve('js-yaml/package.json'),
  );
  assert.equal(yamlRequire('argparse/package.json').version, '2.0.1');
});

async function fixture(work) {
  const cwd = await mkdtemp(join(tmpdir(), 'sprintf-nyc-compat-'));
  try {
    await writeFile(
      join(cwd, 'package.json'),
      JSON.stringify({
        name: 'synthetic-nyc-fixture',
        private: true,
        nyc: { 'report-dir': 'coverage-fixture' },
      }),
    );
    return await work(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

for (const extension of ['yml', 'yaml']) {
  test(`el loader real conserva listas, escalares y claves normalizadas desde .nycrc.${extension}`, async () => {
    await fixture(async (cwd) => {
      await writeFile(
        join(cwd, `.nycrc.${extension}`),
        [
          'include:',
          '  - src/**/*.ts',
          '  - shared/**/*.ts',
          'exclude: test/**',
          'extension: .ts',
          'require: ts-node/register',
          'all: true',
          'check-coverage: true',
          'lines: 85',
          'reporter:',
          '  - text-summary',
          '  - lcov',
          '',
        ].join('\n'),
      );
      assert.deepEqual(await loadNycConfig({ cwd }), {
        cwd,
        reportDir: 'coverage-fixture',
        include: ['src/**/*.ts', 'shared/**/*.ts'],
        exclude: ['test/**'],
        extension: ['.ts'],
        require: ['ts-node/register'],
        all: true,
        checkCoverage: true,
        lines: 85,
        reporter: ['text-summary', 'lcov'],
      });
    });
  });
}

for (const base of ['yaml', 'json']) {
  test(`el loader real conserva extends relativo hacia ${base}`, async () => {
    await fixture(async (cwd) => {
      const basePath = join(cwd, `base.${base}`);
      await writeFile(
        basePath,
        base === 'yaml'
          ? 'include:\n  - src/**/*.ts\nextension: .ts\n'
          : JSON.stringify({ include: ['src/**/*.ts'], extension: '.ts' }),
      );
      await writeFile(
        join(cwd, '.nycrc.yaml'),
        [
          `extends: ./base.${base}`,
          'exclude:',
          '  - test/**',
          'all: true',
          'check-coverage: true',
          '',
        ].join('\n'),
      );
      assert.deepEqual(await loadNycConfig({ cwd }), {
        cwd,
        reportDir: 'coverage-fixture',
        include: ['src/**/*.ts'],
        extension: ['.ts'],
        exclude: ['test/**'],
        all: true,
        checkCoverage: true,
      });
    });
  });
}

test('el loader real rechaza YAML inválido', async () => {
  await fixture(async (cwd) => {
    await writeFile(join(cwd, '.nycrc.yaml'), 'include: [src/**/*.ts\n');
    await assert.rejects(() => loadNycConfig({ cwd }), {
      name: 'YAMLException',
    });
  });
});

test('el loader real rechaza un archivo explícito inexistente', async () => {
  await fixture(async (cwd) => {
    await assert.rejects(
      () => loadNycConfig({ cwd, nycrcPath: join(cwd, 'missing.yaml') }),
      /Requested configuration file .*missing\.yaml not found/,
    );
  });
});
