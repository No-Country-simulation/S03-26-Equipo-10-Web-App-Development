import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactErrors } from './privacy.mjs';
test('sanea errores antes de escribir contexto sin eliminar el fallo', () => {
  const errors = [
    {
      message: 'SENTINEL_PASSWORD',
      stack: 'SENTINEL_COOKIE',
      value: 'SENTINEL_EMAIL',
      errorContext: 'SENTINEL_SNAPSHOT',
      cause: { token: 'SENTINEL_TOKEN' },
      location: { file: 'SENTINEL_URL', line: 42 },
    },
  ];
  const same = errors[0];
  redactErrors(errors);
  assert.equal(errors.length, 1);
  assert.equal(errors[0], same);
  assert.ok(!JSON.stringify(errors).includes('SENTINEL'));
  assert.ok(errors[0].message.includes('line 42'));
});
test('conserva sólo archivo permitido y línea de stack, sin texto ni paths privados', () => {
  const errors = [
    {
      message: 'SENTINEL_PASSWORD',
      stack:
        'Error SENTINEL_COOKIE\n at /private/SENTINEL_URL/e2e/fixtures.ts:37:9',
    },
  ];
  redactErrors(errors);
  assert.ok(errors[0].message.includes('fixtures.ts:37'));
  assert.ok(!JSON.stringify(errors).includes('SENTINEL'));
});
