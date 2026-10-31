import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const executable = fileURLToPath(
  new URL('./acceptance-local.mjs', import.meta.url),
);
test('local acceptance refuses implicit execution and missing migration consent before services', () => {
  for (const [args, consent, reason] of [
    [[], '1', 'BILLING_ACCEPTANCE_EXPLICIT_RUN_REQUIRED'],
    [['--run', '--unknown'], '1', 'BILLING_ACCEPTANCE_EXPLICIT_RUN_REQUIRED'],
    [['--run', '--with-bi'], '1', 'BILLING_ACCEPTANCE_EXPLICIT_RUN_REQUIRED'],
    [
      ['--run', '--api-checks', '--with-bi', '--extra'],
      '1',
      'BILLING_ACCEPTANCE_EXPLICIT_RUN_REQUIRED',
    ],
    [
      ['--run', '--api-checks', '--with-bi'],
      '0',
      'E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 requiere ACK humano específico',
    ],
    [
      ['--run'],
      '0',
      'E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 requiere ACK humano específico',
    ],
  ]) {
    const result = spawnSync(process.execPath, [executable, ...args], {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        E2E_ALLOW_DISPOSABLE_MIGRATIONS: consent,
      },
      encoding: 'utf8',
      timeout: 30000,
    });
    assert.notEqual(result.status, 0);
    assert.equal(result.error, undefined);
    assert.ok(result.stderr.includes(reason));
    assert.equal(result.stdout.includes('initialize owned'), false);
  }
});
