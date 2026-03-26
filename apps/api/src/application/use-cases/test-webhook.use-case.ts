import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WEBHOOK_REPOSITORY, IWebhookRepository } from '../../core/repositories/webhook.repository';
import { WEBHOOK_DISPATCHER, IWebhookDispatcher } from '../ports/webhook-dispatcher.port';

@Injectable()
export class TestWebhookUseCase {
  constructor(
    @Inject(WEBHOOK_REPOSITORY) private readonly webhookRepo: IWebhookRepository,
    @Inject(WEBHOOK_DISPATCHER) private readonly dispatcher: IWebhookDispatcher,
  ) {}

  async execute(tenantId: string, webhookId: string) {
    const webhook = await this.webhookRepo.findById(tenantId, webhookId);
    if (!webhook) throw new NotFoundException('Webhook not found');

    const payload = {
      eventType: webhook.eventCode,
      tenantId,
      test: true,
      sentAt: new Date().toISOString(),
    };

    return this.dispatcher.dispatch(webhook.id, webhook.url, webhook.secret, payload);
  }
}
