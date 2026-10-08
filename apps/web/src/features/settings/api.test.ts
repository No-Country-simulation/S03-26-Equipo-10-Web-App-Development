import { describe, expect, it, vi } from 'vitest';
import { getTenant, removeTenantLogo, uploadTenantLogo } from './api';
import type { SessionFetch } from '@/lib/api/validated-response';

describe('settings logo API contracts', () => {
  const tenant = { id: 'synthetic', name: 'Acme', publicSlug: null, isPublicFormEnabled: false,
    isActive: true, createdAt: '2026-10-08T00:00:00Z', logoUrl: null };

  it('uses session-scoped PUT and DELETE without a client tenant ID', async () => {
    const fetchApi = vi.fn().mockResolvedValue({ success: true, data: tenant });
    expect((await uploadTenantLogo(fetchApi as SessionFetch, 'AAAA')).data.logoUrl).toBeNull();
    await removeTenantLogo(fetchApi as SessionFetch);
    expect(fetchApi.mock.calls).toEqual([
      ['/tenants/me/logo', { method: 'PUT', body: JSON.stringify({ imageBase64: 'AAAA' }) }],
      ['/tenants/me/logo', { method: 'DELETE' }],
    ]);
  });

  it('rejects a success envelope with an invalid logo URL', async () => {
    const fetchApi = vi.fn().mockResolvedValue({ success: true, data: { ...tenant, logoUrl: 'bad URL' } });
    await expect(getTenant(fetchApi as SessionFetch)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
