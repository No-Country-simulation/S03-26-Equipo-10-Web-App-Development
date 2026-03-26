import { Inject, Injectable } from '@nestjs/common';
import { WEBHOOK_REPOSITORY, IWebhookRepository } from '../../core/repositories/webhook.repository';

@Injectable()
export class ListWebhooksUseCase {
  constructor(
    @Inject(WEBHOOK_REPOSITORY) private readonly webhookRepo: IWebhookRepository,
  ) {}

  async execute(tenantId: string) {
    const webhooks = await this.webhookRepo.findByTenant(tenantId);
    return {
      items: webhooks,
      meta: { total: webhooks.length, page: 1, limit: webhooks.length },
    };
  }
}
