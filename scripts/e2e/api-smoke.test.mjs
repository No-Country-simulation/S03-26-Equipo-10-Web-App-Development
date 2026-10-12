import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyApi } from './api-smoke.mjs';
import { spawnSync } from 'node:child_process';

const origin = 'http://127.0.0.1:45678';
const runId = 'abcdef123456';
function fixture(change = () => {}) {
  const calls = [];
  let account;
  let saved;
  const user = { id: 'owner-id', tenantId: 'tenant-id' };
  const request = async (url, options = {}) => {
    const path = new URL(url).pathname;
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ path, options, body });
    const response = { status: 200, data: { user } };
    if (path.endsWith('/register-admin')) {
      account = body;
      Object.assign(response, { status: 201, data: { user } });
    } else if (path.endsWith('/login')) {
      response.status = 201;
      if (body.email === account.email && body.password === account.password)
        response.data = { user, tokens: { accessToken: 'synthetic-access' } };
      else response.status = 401;
    } else if (path === '/api/v1/testimonials' && options.method === 'POST') {
      saved = {
        ...body,
        id: 'saved-id',
        tenantId: user.tenantId,
        status: 'draft',
      };
      Object.assign(response, { status: 201, data: saved });
    } else if (path === '/api/v1/testimonials/saved-id') {
      response.data = saved;
    } else if (path === '/api/v1/internal/metrics') {
      response.status = options.headers?.['x-metrics-token'] ? 200 : 404;
      response.text = '# HELP tms_http_requests_total Synthetic metric';
    }
    change(response, path, options);
    if (response.text !== undefined)
      return new Response(response.text, { status: response.status });
    return Response.json(
      { success: true, data: response.data },
      { status: response.status },
    );
  };
  return { request, calls };
}

test('el smoke exige login exitoso, mutación autenticada y relectura persistida', async () => {
  const { request, calls } = fixture();
  await verifyApi(origin, runId, 'synthetic-metric', request);
  const writes = calls.filter((c) => c.path === '/api/v1/testimonials');
  assert.equal(writes.length, 1);
  assert.equal(
    writes[0].options.headers.Authorization,
    'Bearer synthetic-access',
  );
  assert.ok(calls.some((c) => c.path === '/api/v1/testimonials/saved-id'));
  assert.ok(calls.some((c) => c.path.endsWith('/login') && c.body.password));
});

for (const [name, change] of [
  [
    'login 503',
    (r, path) => {
      if (path.endsWith('/login')) r.status = 503;
    },
  ],
  [
    'login sin access token',
    (r, path) => {
      if (path.endsWith('/login') && r.status === 201) r.data.tokens = {};
    },
  ],
  [
    'mutación rechazada',
    (r, path, o) => {
      if (path.endsWith('/testimonials') && o.method === 'POST') r.status = 403;
    },
  ],
  [
    'lectura con contenido diferente',
    (r, path) => {
      if (path.endsWith('/saved-id'))
        r.data = { ...r.data, content: 'OTHER SENSITIVE VALUE' };
    },
  ],
  [
    'lectura de tenant diferente',
    (r, path) => {
      if (path.endsWith('/saved-id'))
        r.data = { ...r.data, tenantId: 'other-tenant' };
    },
  ],
  [
    'métrica interna pública',
    (r, path, o) => {
      if (path.endsWith('/metrics') && !o.headers?.['x-metrics-token'])
        r.status = 200;
    },
  ],
])
  test(`rechaza ${name} sin exponer datos de respuesta`, async () => {
    const { request } = fixture(change);
    await assert.rejects(
      verifyApi(origin, runId, 'synthetic-metric', request),
      (error) => {
        assert.equal(error.message, 'E2E API smoke contract failed');
        return true;
      },
    );
  });

test('no toca orígenes remotos ni acepta un run ajeno', async () => {
  const { request, calls } = fixture();
  await assert.rejects(
    verifyApi('https://remote.example', runId, 'fixture', request),
  );
  await assert.rejects(verifyApi(origin, 'invalid-run', 'fixture', request));
  assert.equal(calls.length, 0);
});

test('la CLI rechaza una URL como imagen antes de preparar servicios', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/e2e/run.mjs', '--api-smoke', 'https://remote.example/api'],
    {
      encoding: 'utf8',
      env: { PATH: process.env.PATH, E2E_ALLOW_DISPOSABLE_MIGRATIONS: '1' },
      timeout: 5000,
    },
  );
  assert.equal(result.status, 1);
  assert.doesNotMatch(result.stdout, /prepare exclusive/);
});
