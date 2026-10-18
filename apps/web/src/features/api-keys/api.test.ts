import { expect, it, vi } from 'vitest';
import { revokeApiKey, rotateApiKey } from './api';
const input = {
  name: 'Integración sintética',
  scopes: ['testimonials:read'] as Array<'testimonials:read'>,
};
it('rechaza una rotación cuyo resultado pertenece a otra integración', async () => {
  const fetchApi = vi.fn().mockResolvedValue({
    success: true,
    data: { id: 'other', name: input.name, apiKey: 'synthetic-display-only' },
  });
  await expect(rotateApiKey(fetchApi, 'expected', input)).rejects.toMatchObject(
    { code: 'INVALID_RESPONSE' },
  );
});
it.each([
  { id: 'other', revoked: true },
  { id: 'expected', revoked: false },
])(
  'no presenta una revocación ajena o no confirmada como éxito (%j)',
  async (data) => {
    const fetchApi = vi.fn().mockResolvedValue({ success: true, data });
    await expect(revokeApiKey(fetchApi, 'expected')).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    });
  },
);
