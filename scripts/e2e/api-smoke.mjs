import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

// Called only after the harness verifies ownership and the loopback publication.
export async function verifyApi(origin, runId, metricsToken, request = fetch) {
  try {
    const url = new URL(origin);
    assert.equal(url.protocol, 'http:');
    assert.equal(url.hostname, '127.0.0.1');
    assert.ok(
      url.port &&
        url.pathname === '/' &&
        !url.username &&
        !url.password &&
        !url.search &&
        !url.hash,
    );
    assert.match(runId, /^[a-f0-9]{12}$/);
    const account = {
      email: `smoke-${runId}@example.test`,
      password: `Aa1!${randomBytes(24).toString('base64url')}`,
    };
    const headers = {
      'Content-Type': 'application/json',
      'X-Auth-Mode': 'bearer',
    };
    const call = (path, options = {}) =>
      request(`${url.origin}/api/v1${path}`, {
        ...options,
        headers: { ...headers, ...options.headers },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
    const data = async (response, status) => {
      assert.equal(response.status, status);
      const payload = await response.json();
      assert.equal(payload.success, true);
      assert.ok(payload.data && typeof payload.data === 'object');
      return payload.data;
    };
    assert.equal((await call('/health/live')).status, 200);
    const registered = await data(
      await call('/auth/register-admin', {
        method: 'POST',
        body: JSON.stringify({
          ...account,
          tenantName: `Smoke ${runId.replace(/(.{4})/g, '$1 ').trim()}`,
        }),
      }),
      201,
    );
    const session = await data(
      await call('/auth/login', {
        method: 'POST',
        body: JSON.stringify(account),
      }),
      201,
    );
    assert.ok(
      typeof session.tokens?.accessToken === 'string' &&
        session.tokens.accessToken.length > 0,
    );
    assert.ok(
      typeof registered.user?.id === 'string' &&
        typeof registered.user?.tenantId === 'string',
    );
    const authenticated = {
      Authorization: `Bearer ${session.tokens.accessToken}`,
    };
    const me = await data(
      await call('/auth/me', { headers: authenticated }),
      200,
    );
    assert.equal(me.user?.id, registered.user.id);
    assert.equal(me.user?.tenantId, registered.user.tenantId);
    const input = {
      authorName: 'Autor sintético',
      content: 'El artefacto final conserva esta operación autenticada.',
      rating: 5,
    };
    const saved = await data(
      await call('/testimonials', {
        method: 'POST',
        headers: authenticated,
        body: JSON.stringify(input),
      }),
      201,
    );
    assert.ok(typeof saved.id === 'string' && saved.id.length > 0);
    const read = await data(
      await call(`/testimonials/${encodeURIComponent(saved.id)}`, {
        headers: authenticated,
      }),
      200,
    );
    assert.equal(read.id, saved.id);
    assert.equal(read.tenantId, registered.user.tenantId);
    assert.equal(read.content, input.content);
    assert.equal(read.authorName, input.authorName);
    assert.equal(read.rating, input.rating);
    assert.equal(read.status, 'draft');
    assert.equal(
      (
        await call('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ ...account, password: 'WrongSynthetic1!' }),
        })
      ).status,
      401,
    );
    assert.equal((await call('/internal/metrics')).status, 404);
    const metrics = await call('/internal/metrics', {
      headers: { 'x-metrics-token': metricsToken },
    });
    assert.equal(metrics.status, 200);
    assert.match(await metrics.text(), /^# HELP tms_http_requests_total/m);
    return { authenticated: true, persisted: true };
  } catch {
    // Assertion values may contain credentials or business content; never expose them.
    throw new Error('E2E API smoke contract failed');
  }
}
