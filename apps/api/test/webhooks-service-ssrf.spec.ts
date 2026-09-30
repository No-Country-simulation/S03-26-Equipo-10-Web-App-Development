import type { ConfigService } from '@nestjs/config';
import { WebhooksService } from '../src/modules/webhooks/services/webhooks.service';
import { WebhookDestinationPolicy } from '../src/modules/webhooks/services/webhook-destination-policy';
import type { WebhookRepository } from '../src/modules/webhooks/repositories/webhook.repository';
import type { HttpWebhookDispatcher } from '../src/modules/webhooks/services/http-webhook-dispatcher';

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
    findByTenant: jest.fn().mockResolvedValue([legacy]),
  } as unknown as WebhookRepository;
  const service = new WebhooksService(repo, {} as HttpWebhookDispatcher, policy);

  beforeEach(() => {
    (repo.create as jest.Mock).mockClear();
    (repo.update as jest.Mock).mockClear();
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
});
