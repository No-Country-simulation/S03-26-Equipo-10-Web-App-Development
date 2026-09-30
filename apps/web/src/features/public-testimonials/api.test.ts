import { afterEach, describe, expect, it, vi } from 'vitest';
import { listPublicTestimonials, trackPublicEvent } from './api';

describe('public testimonials API adapter', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('reads the published list from the API envelope data array and tracks views', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test/api/v1');
    const testimonial = {
      id: 'one', authorName: 'Ana', content: 'Excelente servicio', rating: 5,
      score: 0.9, publishedAt: '2026-09-29T00:00:00.000Z',
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [testimonial], meta: { total: 1, page: 1, limit: 20 } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: { tracked: true } })));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listPublicTestimonials('tenant-slug')).resolves.toEqual([testimonial]);
    await expect(trackPublicEvent('tenant-slug', 'one', 'view')).resolves.toEqual({ tracked: true });
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual([
      'http://api.test/api/v1/public/testimonials/tenants/tenant-slug',
      'http://api.test/api/v1/public/analytics/tenants/tenant-slug/events',
    ]);
  });

  it('rejects a malformed list rather than rendering untrusted data', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://api.test/api/v1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      success: true, data: { items: [] },
    }))));
    await expect(listPublicTestimonials('tenant-slug')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
