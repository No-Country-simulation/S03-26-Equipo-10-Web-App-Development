// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';
import { getBackendOrigin, normalizeApiBaseUrl } from '../config/api.mjs';

beforeEach(() => {
  vi.stubEnv('API_BACKEND_ORIGIN', 'https://backend.example.test');
  vi.stubEnv('NEXT_PUBLIC_API_URL', '/api/v1');
});
afterEach(() => vi.unstubAllEnvs());

function proxy(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return middleware(new NextRequest(`https://web.example.test${path}`, init));
}

describe('same-origin API boundary', () => {
  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])('rewrites %s to the fixed origin and retains the query', method => {
    const result = proxy('/api/v1/testimonials?tag=a%2Fb&tag=c', { method });
    expect(result.headers.get('x-middleware-rewrite')).toBe('https://backend.example.test/api/v1/testimonials?tag=a%2Fb&tag=c');
    expect(result.headers.get('cache-control')).toBe('private, no-store');
    expect(result.headers.get('vercel-cdn-cache-control')).toBe('no-store');
    expect(result.headers.get('x-vercel-enable-rewrite-caching')).toBe('0');
  });

  it('forwards credentials, original Origin, CSRF and idempotency but strips forged identity and ingress headers', () => {
    const result = proxy('/api/v1/testimonials', { method: 'POST', body: '{"text":"ñ"}', headers: {
      cookie: 'accessToken=test; refreshToken=test', authorization: 'Bearer explicit-test',
      origin: 'https://foreign.example.test', 'x-csrf-token': 'test-csrf', 'x-auth-mode': 'cookie',
      'sec-fetch-site': 'cross-site', 'content-type': 'application/json', 'idempotency-key': 'test-key',
      'x-forwarded-for': '1.1.1.1', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'evil.test',
      'x-user-id': 'admin', 'x-tenant-id': 'victim', 'x-role': 'admin',
      'x-metrics-token': 'test', 'x-middleware-subrequest': 'middleware',
    } });
    for (const [name, value] of Object.entries({
      origin: 'https://foreign.example.test', 'x-csrf-token': 'test-csrf',
      'sec-fetch-site': 'cross-site', 'idempotency-key': 'test-key', authorization: 'Bearer explicit-test',
      cookie: 'accessToken=test; refreshToken=test', 'x-auth-mode': 'cookie',
    })) expect(result.headers.get(`x-middleware-request-${name}`)).toBe(value);
    const allowed = result.headers.get('x-middleware-override-headers')!.split(',');
    expect(allowed).not.toEqual(expect.arrayContaining(['x-tenant-id']));
    for (const name of ['x-forwarded-for', 'x-forwarded-proto', 'x-forwarded-host', 'x-user-id', 'x-role', 'x-metrics-token', 'x-middleware-subrequest']) {
      expect(allowed).not.toContain(name);
    }
  });

  it.each([
    '/api/v1/internal/metrics', '/api/v1/internal/bi/metrics', '/api/v1/INTERNAL/metrics',
    '/api/v1/%69nternal/metrics', '/api/v1/internal%2fmetrics', '/api/v1/%2569nternal/metrics',
    '/api/v1//internal/metrics', '/api/v1/testimonials%5c..%5cinternal/metrics',
    '/api/v1/internal/../internal/metrics', '/api/v1/internal;anything/metrics',
  ])('does not forward internal or ambiguous path %s', path => {
    const result = proxy(path);
    expect(result.status).toBe(404);
    expect(result.headers.has('x-middleware-rewrite')).toBe(false);
  });

  it('strips forged headers even when the caller sends no allowed headers', () => {
    const result = proxy('/api/v1/auth/me', { headers: { 'x-user-id': 'forged' } });
    expect(result.headers.get('x-middleware-override-headers')).toBe('accept');
    expect(result.headers.has('x-middleware-request-x-user-id')).toBe(false);
  });

  it('fails closed when the same-origin destination is missing or invalid', () => {
    vi.stubEnv('API_BACKEND_ORIGIN', '');
    expect(proxy('/api/v1/auth/me').status).toBe(503);
    vi.stubEnv('API_BACKEND_ORIGIN', 'https://backend.test/other');
    expect(proxy('/api/v1/auth/me').status).toBe(503);
  });

  it('fails closed on a destination that would loop back to the web origin', () => {
    vi.stubEnv('API_BACKEND_ORIGIN', 'https://web.example.test');
    expect(proxy('/api/v1/auth/me').status).toBe(503);
  });

  it('keeps legacy direct development usable without a proxy destination', () => {
    vi.stubEnv('API_BACKEND_ORIGIN', '');
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4000/api/v1');
    expect(proxy('/api/v1/auth/me').headers.get('x-middleware-next')).toBe('1');
  });
});

describe('API URL configuration', () => {
  it.each(['/api/v1', 'https://api.test/api/v1', 'http://localhost:4000/api/v1'])('accepts %s', value => {
    expect(normalizeApiBaseUrl(value)).toBe(value);
  });
  it('normalizes legacy /api and a final slash', () => {
    expect(normalizeApiBaseUrl('https://api.test/api/')).toBe('https://api.test/api/v1');
  });
  it.each([undefined, '', '//evil.test/api/v1', '/other', 'javascript:alert(1)', 'https://user:pass@api.test', 'https://api.test?secret=value', 'https://api.test/#fragment'])('rejects unsafe public URL %s', value => {
    expect(() => normalizeApiBaseUrl(value)).toThrow();
  });
  it.each(['https://user:pass@api.test', 'https://api.test/path', 'https://api.test?secret=value', 'https://api.test/#fragment', 'file:///etc', 'http://remote.test'])('rejects unsafe production origin %s', value => {
    expect(() => getBackendOrigin(value, true)).toThrow();
  });
  it('allows HTTPS origins and loopback-only HTTP for local production smoke tests', () => {
    expect(getBackendOrigin('https://api.test/', true)).toBe('https://api.test');
    expect(getBackendOrigin('http://127.0.0.1:4000', true)).toBe('http://127.0.0.1:4000');
  });
});
