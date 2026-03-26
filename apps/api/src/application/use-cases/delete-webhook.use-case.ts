import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WEBHOOK_REPOSITORY, IWebhookRepository } from '../../core/repositories/webhook.repository';

@Injectable()
export class DeleteWebhookUseCase {
  constructor(
    @Inject(WEBHOOK_REPOSITORY) private readonly webhookRepo: IWebhookRepository,
  ) {}

  async execute(tenantId: string, webhookId: string) {
    const webhook = await this.webhookRepo.findById(tenantId, webhookId);
    if (!webhook) throw new NotFoundException('Webhook not found');

    await this.webhookRepo.remove(webhookId);
    return { id: webhookId, deleted: true };
  }
}
