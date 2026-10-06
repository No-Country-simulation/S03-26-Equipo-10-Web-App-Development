import type { ConfigService } from '@nestjs/config';
import { WebhooksService } from '../src/modules/webhooks/services/webhooks.service';
import { WebhookDestinationPolicy } from '../src/modules/webhooks/services/webhook-destination-policy';
import type { WebhookRepository } from '../src/modules/webhooks/repositories/webhook.repository';
import type { OutboxRepository } from '../src/modules/webhooks/repositories/outbox.repository';
import type { WebhookSecretService } from '../src/modules/webhooks/services/webhook-secret.service';

describe('WebhooksService SSRF boundary', () => {
  const policy = new WebhookDestinationPolicy({
    get: () => ({ webhookLegacyHttpStartedAt: '2026-09-30T12:00:00Z' }),
  } as unknown as ConfigService);
  const legacy = {
    id: 'webhook', tenantId: 'tenant', url: 'http://1.1.1.1/hook',
    eventCode: 'testimonial.created', secret: null, isActive: true,
    createdAt: new Date('2026-09-29T12:00:00Z'), updatedAt: new Date('2026-09-29T12:00:00Z'),
  };
  const repo = {
    create: jest.fn(), update: jest.fn(),
    findById: jest.fn().mockResolvedValue(legacy),
    findByTenant: jest.fn().mockResolvedValue({ items: [legacy], total: 1 }),
  } as unknown as WebhookRepository;
  const outbox = { createEvent: jest.fn().mockResolvedValue('event-id'), replayDead: jest.fn() } as unknown as OutboxRepository;
  const secrets = {
    legacyDeadline: () => new Date('2026-10-30T12:00:00Z'), legacyAllowed: () => true,
  } as unknown as WebhookSecretService;
  const service = new WebhooksService(repo, outbox, policy, secrets);

  beforeEach(() => {
    (repo.create as jest.Mock).mockClear();
    (repo.update as jest.Mock).mockClear();
    (outbox.createEvent as jest.Mock).mockClear();
  });

  it('rechaza HTTP en altas y cambios antes de escribir', async () => {
    await expect(service.createWebhook('tenant', {
      url: 'http://1.1.1.1/hook', eventCode: 'testimonial.created',
    })).rejects.toThrow();
    await expect(service.updateWebhook('tenant', 'webhook', {
      url: 'http://1.1.1.1/other',
    })).rejects.toThrow();
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('expone aviso de migración al administrador del tenant', async () => {
    const list = await service.listWebhooks('tenant');
    expect(list.items[0]).toMatchObject({
      id: 'webhook',
      legacyHttp: { deadlineAt: '2026-10-30T12:00:00.000Z' },
    });
  });

  it('encola el envío de prueba para un solo destino y confirma aceptación', async () => {
    await expect(service.testWebhook('tenant', 'webhook')).resolves.toEqual({
      id: 'event-id', status: 'accepted',
    });
    expect(outbox.createEvent).toHaveBeenCalledWith({
      tenantId: 'tenant', eventType: 'testimonial.created',
      payload: { test: true }, targetWebhookId: 'webhook',
    }, undefined);
  });
});
