import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../../', import.meta.url));
const api = path.join(root, 'apps/api');
const web = path.join(root, 'apps/web');
const { ESLint } = createRequire(path.join(api, 'package.json'))('eslint');
// Estas reglas inspeccionan sintaxis, no tipos. En CI el parser con project
// reutiliza inicialmente el SourceFile de disco e ignora el primer lintText.
// Conservamos las reglas reales y analizamos siempre la fixture en memoria.
const eslint = new ESLint({
  cwd: api,
  overrideConfig: { languageOptions: { parserOptions: { project: false } } },
});

for (const expression of [
  "it.only('fixture', () => {})",
  "test['only']('fixture', () => {})",
  "describe.only.each([1])('fixture', () => {})",
  "it.each([1]).only('fixture', () => {})",
  "fit('fixture', () => {})",
  "fdescribe('fixture', () => {})",
]) {
  test(`lint API rechaza ${expression.split('(')[0]}`, async () => {
    const [result] = await eslint.lintText(expression, {
      // Ruta real incluida en tsconfig, sin escribir fixtures enfocadas en el repo.
      filePath: path.join(api, 'test/testimonial-content-validation.spec.ts'),
    });
    assert.ok(
      result.messages.some(
        (m) =>
          ['no-restricted-properties', 'no-restricted-globals'].includes(
            m.ruleId,
          ) && m.severity === 2,
      ),
      JSON.stringify(result.messages),
    );
  });
}

test('lint API permite tests ordinarios y menciones de only en comentarios/texto', async () => {
  const [result] = await eslint.lintText(
    "// it.only\nit('only', () => { expect('it.only').toBe('it.only'); });",
    {
      filePath: path.join(api, 'test/testimonial-content-validation.spec.ts'),
    },
  );
  assert.equal(result.errorCount, 0, JSON.stringify(result.messages));
});

test('Vitest rechaza only incluso en una ejecución local', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'testing-focus-'));
  const config = path.join(directory, 'vitest.config.mts');
  const fixture = path.join(directory, 'fixture.test.ts');
  const cli = path.join(
    path.dirname(
      createRequire(path.join(web, 'package.json')).resolve(
        'vitest/package.json',
      ),
    ),
    'vitest.mjs',
  );
  writeFileSync(fixture, "test.only('fixture', () => { expect(1).toBe(1); });");
  writeFileSync(
    config,
    `import config from ${JSON.stringify(pathToFileURL(path.join(web, 'vitest.config.ts')).href)};\nexport default { ...config, test: { ...config.test, environment: 'node', setupFiles: [], include: [${JSON.stringify(fixture)}] } };\n`,
  );
  // Este subproceso sólo ejecuta la fixture negativa, sin servicios ni datos.
  const env = { ...process.env, CI: '' };
  try {
    const result = spawnSync(
      process.execPath,
      [cli, 'run', '--config', config],
      {
        cwd: web,
        env,
        encoding: 'utf8',
        timeout: 30000,
      },
    );
    assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
    assert.match(
      `${result.stdout}\n${result.stderr}`,
      /only.*allowOnly|allowOnly.*only/s,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
