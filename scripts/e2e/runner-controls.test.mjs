import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../..', import.meta.url));
const cli = join(root, 'node_modules/@playwright/test/cli.js');
const web = join(root, 'apps/web');
function control(source, browser = false) {
  const directory = mkdtempSync(join(tmpdir(), 'e2e-controls-'));
  const config = join(directory, 'playwright.config.ts');
  const output = join(directory, 'artifacts');
  writeFileSync(
    config,
    `import config from ${JSON.stringify(join(web, 'playwright.config.ts'))};
    export default { ...config, testDir: ${JSON.stringify(directory)}, outputDir: ${JSON.stringify(output)},
      projects: [{name: 'desktop', testMatch: '**/control.spec.ts'}],
      reporter: [[${JSON.stringify(join(web, 'e2e/safe-reporter.ts'))}, {outputDir: ${JSON.stringify(join(directory, 'evidence'))}}]] };`,
  );
  const importer = browser
    ? join(web, 'e2e/fixtures.ts')
    : join(root, 'node_modules/@playwright/test/index.js');
  writeFileSync(
    join(directory, 'control.spec.ts'),
    `import { test, expect } from ${JSON.stringify(importer)};\n${source}`,
  );
  try {
    const result = spawnSync(
      process.execPath,
      [cli, 'test', '--config', config],
      {
        cwd: web,
        env: { ...process.env, NODE_ENV: 'test' },
        timeout: 60_000,
        encoding: 'utf8',
      },
    );
    const evidence = JSON.parse(
      readFileSync(join(directory, 'evidence/results.json'), 'utf8'),
    );
    const files = readdirSync(directory, { recursive: true }).filter(
      (path) => path.startsWith('artifacts/') || path.startsWith('evidence/'),
    );
    const contents = files
      .flatMap((path) => {
        try {
          return [readFileSync(resolve(directory, path), 'utf8')];
        } catch (error) {
          if (error.code === 'EISDIR') return [];
          throw error;
        }
      })
      .join('\n');
    return {
      code: result.status,
      output: result.stdout + result.stderr,
      evidence,
      contents,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
test('el runner real rechaza .only con la configuración del proyecto', () => {
  const result = control(
    `test.only('E2E-SESSION focus control', () => { expect(true).toBe(true); });`,
  );
  assert.equal(result.code, 1);
  assert.equal(result.evidence.complete, false);
  assert.equal(result.evidence.executed, 0); // discovery blocked before any test executes
});
test('el runner real rechaza una selección parcial aunque el test apruebe', () => {
  const result = control(
    `test('E2E-SESSION ordinary control', () => { expect(true).toBe(true); });`,
  );
  assert.equal(result.code, 1);
  assert.equal(result.evidence.passed, 1);
  assert.equal(result.evidence.complete, false);
});
test('fallo real conserva status failed sin stdout ni contexto sensible en disco', () => {
  const result = control(
    `test('E2E-SESSION privacy control', async ({ page }) => {
    await page.setContent('<input value="SENTINEL_FORM_EMAIL"><input type="password" value="SENTINEL_FORM_PASSWORD">');
    console.log('SENTINEL_STDOUT_TOKEN');
    expect('SENTINEL_ASSERTION_COOKIE').toBe('different');
  });`,
    true,
  );
  assert.equal(result.code, 1);
  assert.equal(result.evidence.cases[0].status, 'failed');
  assert.equal(result.evidence.complete, false);
  assert.ok(!result.output.includes('SENTINEL'));
  assert.ok(!result.contents.includes('SENTINEL'));
});
