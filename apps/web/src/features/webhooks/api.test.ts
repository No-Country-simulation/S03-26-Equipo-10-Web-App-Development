import { expect, it, vi } from 'vitest';
import {
  deleteWebhook,
  listWebhookDeliveries,
  replayWebhookDelivery,
  rotateWebhookSecret,
} from './api';
const date = '2026-10-18T00:00:00Z';
it('no mezcla entregas de un destino ajeno aunque la respuesta esté bien formada', async () => {
  const fetchApi = vi.fn().mockResolvedValue({
    success: true,
    data: [
      {
        id: 'delivery',
        webhookId: 'other',
        status: 'dead',
        attempts: 1,
        responseCode: 503,
        createdAt: date,
      },
    ],
    meta: { page: 1, limit: 20, total: 1 },
  });
  await expect(
    listWebhookDeliveries(fetchApi, 'expected'),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
it.each([
  { id: 'other', deleted: true },
  { id: 'expected', deleted: false },
])('no acredita un archivo ajeno o sin confirmar (%j)', async (data) => {
  const fetchApi = vi.fn().mockResolvedValue({ success: true, data });
  await expect(deleteWebhook(fetchApi, 'expected')).rejects.toMatchObject({
    code: 'INVALID_RESPONSE',
  });
});
it('el reenvío confirma la entrega solicitada, no otra', async () => {
  const fetchApi = vi.fn().mockResolvedValue({
    success: true,
    data: { id: 'other', status: 'pending' },
  });
  await expect(
    replayWebhookDelivery(fetchApi, 'target', 'delivery'),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
});
it('la rotación no revela una credencial de otro destino', async () => {
  const fetchApi = vi.fn().mockResolvedValue({
    success: true,
    data: {
      id: 'other',
      tenantId: 'tenant',
      url: 'https://receiver.example.invalid/events',
      eventCode: 'testimonial.created',
      isActive: true,
      hasSignature: true,
      signatureGraceUntil: null,
      createdAt: date,
      updatedAt: date,
      signingSecret: 'synthetic-display-only',
    },
  });
  await expect(rotateWebhookSecret(fetchApi, 'expected')).rejects.toMatchObject(
    { code: 'INVALID_RESPONSE' },
  );
});

it('PATCH exige el ID y el estado confirmados antes de comunicar una pausa', async () => {
  const { updateWebhook } = await import('./api');
  const record = {
    id: 'expected',
    tenantId: 'tenant',
    url: 'https://receiver.example.invalid/events',
    eventCode: 'testimonial.created',
    isActive: true,
    hasSignature: true,
    signatureGraceUntil: null,
    createdAt: date,
    updatedAt: date,
  };
  const fetchApi = vi.fn().mockResolvedValue({ success: true, data: record });
  await expect(
    updateWebhook(fetchApi, 'expected', { isActive: false }),
  ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  fetchApi.mockResolvedValue({
    success: true,
    data: { ...record, isActive: false },
  });
  await expect(
    updateWebhook(fetchApi, 'expected', { isActive: false }),
  ).resolves.toMatchObject({ data: { isActive: false } });
  expect(JSON.parse(fetchApi.mock.calls.at(-1)![1].body)).toEqual({
    isActive: false,
  });
});
