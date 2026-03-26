import { Inject, Injectable } from '@nestjs/common';
import { WEBHOOK_REPOSITORY, IWebhookRepository } from '../../core/repositories/webhook.repository';
import { CreateWebhookDto } from '../dtos/webhook.dto';

@Injectable()
export class CreateWebhookUseCase {
  constructor(
    @Inject(WEBHOOK_REPOSITORY) private readonly webhookRepo: IWebhookRepository,
  ) {}

  async execute(tenantId: string, dto: CreateWebhookDto) {
    return this.webhookRepo.create({
      tenantId,
      url: dto.url,
      eventCode: dto.eventCode,
      secret: dto.secret,
      isActive: dto.isActive,
    });
  }
}
