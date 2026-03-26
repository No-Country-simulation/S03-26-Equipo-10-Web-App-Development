import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WEBHOOK_REPOSITORY, IWebhookRepository } from '../../core/repositories/webhook.repository';

@Injectable()
export class ListWebhookDeliveriesUseCase {
  constructor(
    @Inject(WEBHOOK_REPOSITORY) private readonly webhookRepo: IWebhookRepository,
  ) {}

  async execute(tenantId: string, webhookId: string) {
    const webhook = await this.webhookRepo.findById(tenantId, webhookId);
    if (!webhook) throw new NotFoundException('Webhook not found');

    const deliveries = await this.webhookRepo.findDeliveries(webhookId);
    return {
      items: deliveries,
      meta: { total: deliveries.length, page: 1, limit: deliveries.length },
    };
  }
}
