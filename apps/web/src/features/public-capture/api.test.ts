import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFormInfo, submitPublicTestimonial } from './api';

describe('public capture API adapter', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('loads form state and submits a testimonial through the existing public routes', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test/api/v1');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { name: 'Tenant', isPublicFormEnabled: true } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { status: 'success', id: 'one' } })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getFormInfo('tenant-slug')).resolves.toEqual({ name: 'Tenant', isPublicFormEnabled: true });
    await expect(submitPublicTestimonial('tenant-slug', { authorName: 'Ana', content: 'Muy bueno', rating: 5 }))
      .resolves.toEqual({ status: 'success', id: 'one' });
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      'http://api.test/api/v1/public/testimonials/tenant-slug/form-info',
      'http://api.test/api/v1/public/testimonials/tenant-slug/submit',
    ]);
  });

  it('rejects a success envelope that lacks a saved testimonial id', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test/api/v1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true, data: { status: 'received' },
    }))));

    await expect(submitPublicTestimonial('tenant-slug', {
      authorName: 'Ana', content: 'Excelente atención', rating: 5,
    })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
