import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticatedRequest, clearSessionMemory, recoverSession } from './api';

const user = {
  id: 'user-1', email: 'admin@example.test', tenantId: 'tenant-1',
  tenantName: 'Tenant', roles: ['admin'], isActive: true,
};

describe('cookie session and one-use migration', () => {
  beforeEach(() => {
    clearSessionMemory();
    localStorage.clear();
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.test/api/v1');
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); localStorage.clear(); });

  it('consumes the legacy refresh token once and never writes a new token to localStorage', async () => {
    localStorage.setItem('testimonial-cms.session', JSON.stringify({
      user, tokens: { accessToken: 'old-access', refreshToken: 'old-refresh-token-long-enough' },
    }));
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true, data: { user },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const recoveries = await Promise.all([recoverSession(), recoverSession()]);
    expect(recoveries).toEqual([{ user }, { user }]);
    expect(localStorage.getItem('testimonial-cms.session')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.example.test/api/v1/auth/upgrade-session');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ credentials: 'include' });
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ refreshToken: 'old-refresh-token-long-enough' });
  });

  it('gets a session-bound CSRF token before a cookie mutation', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify({
      success: true, data: url.endsWith('/auth/csrf') ? { csrfToken: 'session-csrf' } : { ok: true },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await authenticatedRequest('/testimonials', { method: 'POST', body: '{}' });
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      'https://api.example.test/api/v1/auth/csrf',
      'https://api.example.test/api/v1/testimonials',
    ]);
    expect(fetchMock.mock.calls[1]![1].headers.get('x-csrf-token')).toBe('session-csrf');
    expect(localStorage.length).toBe(0);
  });
});
