import assert from 'node:assert/strict';
import { test } from 'node:test';
import { caseIds, summarize } from './evidence.mjs';
const records = () =>
  caseIds.map((id) => ({
    id,
    project: 'desktop',
    status: 'passed',
    duration: 15.5,
    retry: 0,
  }));
const options = { total: 6, status: 'passed' };
test('acepta los seis recorridos completos sin reintentos', () =>
  assert.equal(summarize(records(), options).complete, true));
for (const status of [
  'failed',
  'timedOut',
  'skipped',
  'interrupted',
  'invented',
]) {
  test(`rechaza evidencia ${status}`, () => {
    const input = records();
    input[0].status = status;
    assert.equal(summarize(input, options).complete, false);
  });
}
test('rechaza suite vacía, selección parcial, caso duplicado, retry y error global', () => {
  assert.equal(summarize([], options).complete, false);
  assert.equal(
    summarize(records().slice(1), { total: 5, status: 'passed' }).complete,
    false,
  );
  const input = records();
  input[0] = input[1];
  assert.equal(summarize(input, options).complete, false);
  input[0] = { ...records()[0], retry: 1 };
  assert.equal(summarize(input, options).complete, false);
  assert.equal(summarize(records(), { ...options, errors: 1 }).complete, false);
});
test('elimina credenciales incluso en campos desconocidos y títulos de error', () => {
  const input = records();
  input[0] = {
    ...input[0],
    password: 'SENTINEL_PASSWORD',
    error: 'SENTINEL_TOKEN',
    title: 'SENTINEL_EMAIL',
    stdout: 'SENTINEL_COOKIE',
    attachments: ['SENTINEL_TRACE'],
  };
  const output = JSON.stringify(summarize(input, options));
  assert.ok(!output.includes('SENTINEL'));
  input[0].id = 'SENTINEL_TOKEN';
  input[0].project = 'SENTINEL_EMAIL';
  input[0].status = 'SENTINEL_COOKIE';
  assert.ok(!JSON.stringify(summarize(input, options)).includes('SENTINEL'));
});
