import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestApi } from '@/lib/api';
import { listTestimonials } from '@/features/testimonials/api';
import { listCategories, listTags } from '@/features/catalog/api';
import { listUsers } from '@/features/users/api';
import { listApiKeys } from '@/features/api-keys/api';
import { listWebhookDeliveries, listWebhooks } from '@/features/webhooks/api';

const meta = { page: 2, limit: 20, total: 21 };
function wire(payload: unknown) {
  vi.stubEnv('NEXT_PUBLIC_API_URL', '/api/v1');
  const fetch = vi.fn().mockResolvedValue(Response.json(payload));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('contrato HTTP de paginación administrativa: data[] y meta en envelope', () => {
  it.each([
    ['testimonials', () => listTestimonials(requestApi, 2)],
    ['categories', () => listCategories(requestApi, 2)],
    ['tags', () => listTags(requestApi, 2)],
    ['users', () => listUsers(requestApi, 2)],
    ['api-keys', () => listApiKeys(requestApi, 2)],
    ['webhooks', () => listWebhooks(requestApi, 2)],
    [
      'webhooks/fixture/deliveries',
      () => listWebhookDeliveries(requestApi, 'fixture', 2),
    ],
  ] as const)(
    'adapta %s sin cambiar el formato de transporte',
    async (resource, read) => {
      const fetch = wire({ success: true, data: [], meta });
      await expect(read()).resolves.toMatchObject({
        success: true,
        data: { items: [], meta },
      });
      expect(fetch).toHaveBeenCalledWith(
        `/api/v1/${resource}?page=2&limit=20`,
        expect.objectContaining({ credentials: 'include' }),
      );
    },
  );
  it('conserva un testimonio real y valida sus campos antes de mostrarlo', async () => {
    const record = {
      id: 'fixture',
      authorName: 'Autor sintético',
      content: 'Contenido persistido de ejemplo',
      rating: 5,
      status: 'pending',
      score: 0,
      createdAt: '2026-10-12T00:00:00Z',
    };
    wire({ success: true, data: [record], meta });
    await expect(listTestimonials(requestApi, 2)).resolves.toMatchObject({
      data: { items: [record], meta },
    });
    wire({
      success: true,
      data: [record, { ...record, id: 'second' }],
      meta: { ...meta, limit: 1 },
    });
    await expect(listTestimonials(requestApi, 2)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
  it.each([
    { success: true, data: [] },
    { success: true, data: [], meta: { ...meta, page: 0 } },
    { success: true, data: [], meta: { ...meta, total: '21' } },
    { success: true, data: [], meta: { ...meta, limit: 0 } },
    { success: true, data: { items: [], meta } },
    { success: true, data: [{ id: 'incomplete' }], meta },
    { success: false, data: [], meta },
  ])('rechaza respuesta inválida %#', async (payload) => {
    wire(payload);
    await expect(listTestimonials(requestApi, 2)).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  });
});
