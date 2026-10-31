import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
const configRequire = createRequire(webRequire.resolve('eslint-config-next'));
const pluginRequire = createRequire(configRequire.resolve('@next/eslint-plugin-next'));
const { globSync } = pluginRequire('fast-glob');
const { getRootDirs } = pluginRequire('./utils/get-root-dirs');
const nextPlugin = configRequire('@next/eslint-plugin-next');
const { Linter } = require('eslint');

test('la configuración web real carga y conserva las fronteras de arquitectura en TSX', async () => {
  const { ESLint } = require('eslint');
  const eslint = new ESLint({
    cwd: fileURLToPath(new URL('../apps/web/', import.meta.url)),
  });
  const filePath = 'src/features/testimonials/screens/lint-probe.tsx';
  const [valid] = await eslint.lintText(
    'export default function Probe() { return <p>Prueba</p>; }',
    { filePath },
  );
  assert.equal(valid.errorCount, 0);
  assert.equal(valid.warningCount, 0);

  const [invalid] = await eslint.lintText(
    "import { service } from '@testimonial-cms/api';\n" +
      "import { requestApi } from '@/lib/api';\n" +
      'export default function Probe() { return <p>{String(service ?? requestApi)}</p>; }',
    { filePath },
  );
  assert.ok(
    invalid.messages.some(({ ruleId }) => ruleId === 'no-restricted-imports'),
  );
  assert.ok(
    invalid.messages.some(({ ruleId }) => ruleId === 'no-restricted-syntax'),
  );
});

test('el buscador de Next conserva directorios, patrones y reglas de enlaces', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'next-lint-glob-'));
  try {
    for (const app of ['store', 'admin console']) {
      mkdirSync(join(fixture, app, 'app/docs'), { recursive: true });
      mkdirSync(join(fixture, app, 'pages'), { recursive: true });
      writeFileSync(join(fixture, app, 'app/page.tsx'), 'export default function Page() {}');
      writeFileSync(join(fixture, app, 'app/docs/page.tsx'), 'export default function Page() {}');
      writeFileSync(join(fixture, app, 'pages/docs.tsx'), 'export default function Page() {}');
    }
    writeFileSync(join(fixture, 'not-a-directory'), 'fixture');
    const roots = ['admin console', 'store'].map((name) => join(fixture, name));
    assert.deepEqual(globSync(`${fixture}/*`, { onlyDirectories: true }).sort(), roots);
    assert.deepEqual(
      getRootDirs({ cwd: fixture, settings: { next: { rootDir: `${fixture}/{store,admin console}` } } }).sort(),
      roots,
    );
    assert.deepEqual(
      getRootDirs({ cwd: fixture, settings: { next: { rootDir: roots } } }).sort(),
      roots,
    );
    assert.deepEqual(getRootDirs({ cwd: fixture, settings: {} }), [fixture]);
    assert.throws(() => globSync(fixture, { onlyDirectories: true, dot: true }), TypeError);

    const linter = new Linter({ cwd: fixture });
    const config = [{
      languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
      plugins: { '@next/next': nextPlugin },
      settings: { next: { rootDir: `${fixture}/*` } },
      rules: { '@next/next/no-html-link-for-pages': 'error' },
    }];
    const invalid = linter.verify('const link = <a href="/docs">Docs</a>;', config);
    assert.equal(invalid.length, 1);
    assert.equal(invalid[0].ruleId, '@next/next/no-html-link-for-pages');
    for (const code of [
      'const link = <a href="https://example.com/docs">Docs</a>;',
      'const link = <Link href="/docs">Docs</Link>;',
      'const link = <a href="/docs" download>Docs</a>;',
    ]) {
      assert.deepEqual(linter.verify(code, config), []);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
