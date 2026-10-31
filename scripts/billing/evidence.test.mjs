import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cases, summarize } from './evidence.mjs';
const records = () =>
  Object.entries(cases).map(([id, project]) => ({
    id,
    project,
    status: 'passed',
    retry: 0,
    duration: 1,
  }));
test('requires each billing journey exactly once in its intended viewport', () => {
  const ok = records();
  assert.equal(summarize(ok, { status: 'passed', total: 5 }).complete, true);
  for (const changed of [
    ok.slice(1),
    [...ok, ok[0]],
    [ok[0], ...ok.slice(0, 4)],
    ok.map((r, i) => (i ? r : { ...r, project: 'mobile' })),
    ok.map((r, i) => (i ? r : { ...r, retry: 1 })),
    ok.map((r, i) => (i ? r : { ...r, status: 'skipped' })),
  ])
    assert.equal(
      summarize(changed, { status: 'passed', total: changed.length }).complete,
      false,
    );
  assert.equal(summarize(ok, { status: 'failed', total: 5 }).complete, false);
  assert.equal(
    summarize(ok, { status: 'passed', total: 5, errors: 1 }).complete,
    false,
  );
});
test('evidence discards arbitrary names, errors, tokens, urls and extra properties', () => {
  const report = summarize(
    [
      {
        id: 'SENTINEL_SECRET',
        project: 'SENTINEL_SECRET',
        status: 'SENTINEL_SECRET',
        retry: NaN,
        duration: NaN,
        token: 'SENTINEL_SECRET',
        error: 'SENTINEL_SECRET',
      },
    ],
    { status: 'passed', total: 1 },
  );
  assert.equal(JSON.stringify(report).includes('SENTINEL'), false);
  assert.equal(report.complete, false);
});

test('billing failure locations retain allowed source lines without rich diagnostics', async () => {
  const { redactErrors } = await import('../e2e/privacy.mjs');
  for (const file of ['billing-desktop.spec.ts', 'billing-mobile.spec.ts']) {
    const errors = [
      {
        message: 'SENTINEL_PASSWORD',
        stack: `Error SENTINEL_COOKIE at /private/SENTINEL_URL/${file}:42:3`,
        cause: 'SENTINEL_TOKEN',
      },
    ];
    redactErrors(errors);
    assert.equal(errors.length, 1);
    assert.equal(JSON.stringify(errors).includes('SENTINEL'), false);
    assert.ok(errors[0].message.includes(`${file}:42`));
  }
});
