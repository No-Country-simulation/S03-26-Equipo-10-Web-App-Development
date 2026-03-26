import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { WEBHOOK_REPOSITORY, IWebhookRepository } from '../../core/repositories/webhook.repository';
import { UpdateWebhookDto } from '../dtos/webhook.dto';

@Injectable()
export class UpdateWebhookUseCase {
  constructor(
    @Inject(WEBHOOK_REPOSITORY) private readonly webhookRepo: IWebhookRepository,
  ) {}

  async execute(tenantId: string, webhookId: string, dto: UpdateWebhookDto) {
    const webhook = await this.webhookRepo.findById(tenantId, webhookId);
    if (!webhook) throw new NotFoundException('Webhook not found');

    return this.webhookRepo.update(webhookId, {
      url: dto.url,
      eventCode: dto.eventCode,
      secret: dto.secret,
      isActive: dto.isActive,
    });
  }
}
