import { describe, expect, it, vi } from 'vitest';
import { getTenant, removeTenantLogo, uploadTenantLogo } from './api';
import type { SessionFetch } from '@/lib/api/validated-response';

describe('settings logo API contracts', () => {
  const tenant = {
    id: 'synthetic',
    name: 'Acme',
    publicSlug: null,
    isPublicFormEnabled: false,
    isActive: true,
    createdAt: '2026-10-08T00:00:00Z',
    logoUrl: null,
  };

  it('uses session-scoped PUT and DELETE without a client tenant ID', async () => {
    const fetchApi = vi.fn().mockResolvedValue({ success: true, data: tenant });
    expect(
      (await uploadTenantLogo(fetchApi as SessionFetch, 'AAAA')).data.logoUrl,
    ).toBeNull();
    await removeTenantLogo(fetchApi as SessionFetch);
    expect(fetchApi.mock.calls).toEqual([
      [
        '/tenants/me/logo',
        { method: 'PUT', body: JSON.stringify({ imageBase64: 'AAAA' }) },
      ],
      ['/tenants/me/logo', { method: 'DELETE' }],
    ]);
  });

  it('rejects a success envelope with an invalid logo URL', async () => {
    const fetchApi = vi.fn().mockResolvedValue({
      success: true,
      data: { ...tenant, logoUrl: 'bad URL' },
    });
    await expect(getTenant(fetchApi as SessionFetch)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
});

describe('workspace and feature flag confirmations', () => {
  it('validates persisted name, flag identity, tenant and enabled state', async () => {
    const { updateTenant, updateFeatureFlag } = await import('./api');
    const tenant = {
      id: 'synthetic',
      name: 'Anterior',
      publicSlug: null,
      isPublicFormEnabled: false,
      isActive: true,
      createdAt: '2026-10-08T00:00:00Z',
      logoUrl: null,
    };
    const fetchApi = vi.fn().mockResolvedValue({ success: true, data: tenant });
    await expect(
      updateTenant(
        fetchApi as SessionFetch,
        { name: 'Nuevo nombre' },
        tenant.id,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    const result = {
      flagName: 'enable_scoring',
      enabled: false,
      tenantId: tenant.id,
      updatedAt: '2026-10-18T00:00:00Z',
    };
    for (const wrong of [
      { enabled: true },
      { tenantId: 'foreign' },
      { flagName: 'enable_webhooks' },
      { updatedAt: 'invalid' },
    ]) {
      fetchApi.mockResolvedValue({
        success: true,
        data: { ...result, ...wrong },
      });
      await expect(
        updateFeatureFlag(
          fetchApi as SessionFetch,
          'enable_scoring',
          false,
          tenant.id,
        ),
      ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
    fetchApi.mockResolvedValue({ success: true, data: result });
    expect(
      (
        await updateFeatureFlag(
          fetchApi as SessionFetch,
          'enable_scoring',
          false,
          tenant.id,
        )
      ).data,
    ).toEqual(result);
    expect(fetchApi).toHaveBeenLastCalledWith('/feature-flags/enable_scoring', {
      method: 'PATCH',
      body: JSON.stringify({ enabled: false }),
    });
  });
});
