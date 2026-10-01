import { afterEach, describe, expect, it, vi } from 'vitest';
import { login, registerAdmin } from './api';

const session = {
  user: {
    id: 'user-1', email: 'admin@example.com', tenantId: 'tenant-1', tenantName: 'Tenant',
    roles: ['admin'], isActive: true, createdAt: '2026-09-29T00:00:00.000Z',
  },
};

describe('auth API adapter', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('requests cookie mode and validates responses without tokens', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test/api/v1');
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ success: true, data: session }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(login({ email: 'admin@example.com', password: 'secret' })).resolves.toEqual(session);
    await expect(registerAdmin({ tenantName: 'Tenant', email: 'admin@example.com', password: 'secret' }))
      .resolves.toEqual(session);
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      'http://api.test/api/v1/auth/login', 'http://api.test/api/v1/auth/register-admin',
    ]);
    expect(fetchMock.mock.calls.every(call => call[1].credentials === 'include'
      && call[1].headers.get('X-Auth-Mode') === 'cookie')).toBe(true);
  });

  it('rejects a successful HTTP response without a valid user', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test/api/v1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true, data: { tokens: { accessToken: 'access' } },
    }), { status: 200 })));

    await expect(login({ email: 'admin@example.com', password: 'secret' }))
      .rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
