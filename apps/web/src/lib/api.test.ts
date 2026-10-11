import { afterEach, expect, it, vi } from 'vitest';
import { requestApi } from './api';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('sends relative same-origin requests with credentials and no cache', async () => {
  vi.stubEnv('NEXT_PUBLIC_API_URL', '/api/v1');
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ success: true, data: { ok: true } }));
  vi.stubGlobal('fetch', fetchMock);
  await requestApi('/auth/me');
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/me', expect.objectContaining({ credentials: 'include', cache: 'no-store' }));
});
