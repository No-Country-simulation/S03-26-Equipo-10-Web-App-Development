/** Run after the same-origin web build:
 * NEXT_PUBLIC_API_URL=/api/v1 API_BACKEND_ORIGIN=http://127.0.0.1:4100 npm run build -w @testimonial-cms/web
 * node scripts/web-proxy-smoke.mjs [--serve]
 * --serve keeps the synthetic HTTP fixture available for a real browser.
 */
import { createRequire } from 'node:module';
import { cpSync, readFileSync } from 'node:fs';
import { request } from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const require = createRequire(import.meta.url);
const { transformSync } = require('@swc/core');
require.extensions['.ts'] = (module, filename) => {
  const { code } = transformSync(readFileSync(filename, 'utf8'), {
    filename, module: { type: 'commonjs' }, jsc: {
      target: 'es2022', parser: { syntax: 'typescript', decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
    },
  });
  module._compile(code, filename);
};
process.env.NODE_ENV = 'production';
process.env.RUN_WEB_PROXY_FIXTURE = '1';
const { startWebProxyFixture } = require('../apps/api/test/support/web-proxy.fixture.ts');
// Match the production image's standalone entrypoint and asset layout.
const standaloneWeb = 'apps/web/.next/standalone/apps/web';
cpSync('apps/web/.next/static', `${standaloneWeb}/.next/static`, { recursive: true });
cpSync('apps/web/public', `${standaloneWeb}/public`, { recursive: true });
const app = await startWebProxyFixture();
const web = spawn(process.execPath, [`${standaloneWeb}/server.js`], {
  env: { ...process.env, PORT: '3100', HOSTNAME: '127.0.0.1', NEXT_PUBLIC_API_URL: '/api/v1', API_BACKEND_ORIGIN: 'http://127.0.0.1:4100', NEXT_TELEMETRY_DISABLED: '1' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
let stopped = false;
async function stop() {
  if (stopped) return; stopped = true;
  web.kill('SIGTERM'); await app.close();
}
for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => { void stop().finally(() => process.exit(0)); });
function call(path, method = 'GET', body, headers = {}) {
  return new Promise((resolve, reject) => {
    const framedHeaders = body === undefined ? headers : { ...headers, 'Content-Length': String(Buffer.byteLength(body)) };
    const req = request({ hostname: '127.0.0.1', port: 3100, path, method, headers: framedHeaders }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString() }));
    });
    req.setTimeout(35_000, () => req.destroy(new Error('Local proxy request timed out')));
    req.on('error', reject); req.end(body);
  });
}
try {
  let ready = false;
  for (let n = 0; n < 80; n++) {
    if (web.exitCode !== null) throw new Error('Next.js exited before smoke tests');
    try { if ((await call('/api/v1/proxy-fixture/headers')).status === 200) { ready = true; break; } } catch { /* startup */ }
    await delay(250);
  }
  assert.ok(ready, 'Next.js startup timeout');
  const page = await call('/login');
  assert.equal(page.status, 200);
  assert.ok(page.headers['content-security-policy'].includes("connect-src 'self';"));
  assert.ok(!page.headers['content-security-policy'].includes('127.0.0.1:4100'));
  const headers = { 'Content-Type': 'application/json', Origin: 'http://localhost:3100', 'X-Auth-Mode': 'cookie' };
  const register = await call('/api/v1/auth/register-admin', 'POST', JSON.stringify({
    email: 'http-proxy@example.test', tenantName: 'Synthetic HTTP', password: 'SyntheticPassword123!',
  }), headers);
  assert.equal(register.status, 201);
  const cookies = register.headers['set-cookie'];
  assert.equal(cookies.length, 2, 'Set-Cookie must remain separate');
  assert.ok(cookies.every(cookie => /HttpOnly/.test(cookie) && /Secure/.test(cookie) && /SameSite=Strict/.test(cookie) && /Path=\//.test(cookie) && !/Domain=/.test(cookie)));
  assert.equal(JSON.parse(register.text).data.tokens, undefined);
  const sessionHeaders = { ...headers, cookie: cookies.map(cookie => cookie.split(';')[0]).join('; ') };
  let result = await call('/api/v1/auth/csrf', 'GET', undefined, sessionHeaders);
  const csrf = JSON.parse(result.text).data.csrfToken;
  result = await call('/api/v1/proxy-fixture/mutate', 'POST', '{}', sessionHeaders);
  assert.equal(result.status, 403);
  result = await call('/api/v1/proxy-fixture/mutate', 'POST', '{}', { ...sessionHeaders, 'x-csrf-token': csrf, 'x-tenant-id': 'forged', 'x-role': 'editor' });
  assert.equal(result.status, 201);
  assert.equal(JSON.parse(result.text).data.tenantId, JSON.parse(register.text).data.user.tenantId);
  result = await call('/api/v1/auth/login', 'POST', '{}', { ...headers, Origin: 'https://foreign.example.test', 'X-Forwarded-Host': 'foreign.example.test', 'X-Forwarded-Proto': 'https' });
  assert.equal(result.status, 403, 'Origin must not be rewritten to the allowed origin');
  result = await call('/api/v1/proxy-fixture/headers', 'GET', undefined, { 'X-User-Id': 'admin', 'X-Tenant-Id': 'victim', 'X-Role': 'admin', 'X-Forwarded-For': '1.1.1.1', 'X-Metrics-Token': 'test', 'X-Middleware-Subrequest': 'src/middleware' });
  const forwarded = JSON.parse(result.text).data;
  for (const name of ['x-user-id', 'x-tenant-id', 'x-role', 'x-metrics-token']) assert.equal(forwarded.headers[name], undefined);
  assert.notEqual(forwarded.ip, '1.1.1.1');
  for (const path of ['/api/v1/internal/metrics', '/api/v1/internal/bi/metrics', '/api/v1/%69nternal/metrics', '/api/v1/internal%2fmetrics', '/api/v1/%2569nternal/metrics', '/api/v1/internal/../internal/metrics', '/api/v1/internal;extra/metrics', '/api/v1/INTERNAL/metrics']) {
    assert.equal((await call(path)).status, 404, path);
  }
  for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
    result = await call('/api/v1/proxy-fixture/echo?a=x%2Fy&a=z', method, ['GET', 'HEAD'].includes(method) ? undefined : 'raw bytes ñ', { 'Content-Type': 'application/octet-stream' });
    assert.equal(result.status, 200, method);
    assert.ok(result.headers['cache-control'].includes('no-store'), method);
    assert.equal(result.headers['vercel-cdn-cache-control'], 'no-store', method);
    if (method !== 'HEAD') {
      const echo = JSON.parse(result.text).data ?? JSON.parse(result.text);
      assert.equal(echo.method, method);
      assert.equal(echo.url, '/api/v1/proxy-fixture/echo?a=x%2Fy&a=z');
      if (method !== 'GET') assert.equal(echo.sha256, createHash('sha256').update('raw bytes ñ').digest('hex'));
    }
  }
  result = await call('/api/v1/auth/logout', 'POST', '{}', { ...sessionHeaders, 'x-csrf-token': csrf });
  assert.equal(result.status, 201);
  assert.equal(result.headers['set-cookie'].length, 4, 'Logout must retain all cookie clearing paths');
  assert.ok(result.headers['set-cookie'].every(cookie => cookie.includes('Expires=Thu, 01 Jan 1970')));
  assert.equal((await call('/api/v1/auth/me', 'GET', undefined, sessionHeaders)).status, 401);
  const large = Buffer.alloc(14 * 1024 * 1024, 'x');
  result = await call('/api/v1/proxy-fixture/echo', 'POST', large, { 'Content-Type': 'application/octet-stream', 'Content-Length': String(large.length) });
  assert.equal(result.status, 200);
  const echo = JSON.parse(result.text);
  assert.equal(echo.size, large.length); assert.equal(echo.sha256, createHash('sha256').update(large).digest('hex'));
  console.log('PASS: cookies Secure/HttpOnly/Strict, CSRF, foreign Origin, identity headers, internal metrics, seven HTTP methods, query, cache and exact 14 MiB body.');
  if (process.argv.includes('--serve')) {
    console.log('Synthetic browser fixture: http://localhost:3100/api/v1/proxy-fixture/browser');
    await new Promise(resolve => { web.once('exit', resolve); });
  }
} finally { await stop(); }
