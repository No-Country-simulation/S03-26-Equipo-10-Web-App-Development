import { NotFoundError } from '../../../common/errors/application.error';
import { Injectable } from '@nestjs/common';
import { WebhookRepository } from '../repositories/webhook.repository';
import { CreateWebhookDto, UpdateWebhookDto } from '../dto/webhook.dto';
import { WebhookDestinationPolicy } from './webhook-destination-policy';
import type { WebhookView } from '../repositories/webhook.repository';
import { OutboxRepository } from '../repositories/outbox.repository';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly webhookRepo: WebhookRepository,
    private readonly outbox: OutboxRepository,
    private readonly destinationPolicy: WebhookDestinationPolicy,
  ) {}

  async createWebhook(tenantId: string, dto: CreateWebhookDto) {
    await this.destinationPolicy.validateNewUrl(dto.url);
    return this.webhookRepo.create({
      tenantId,
      url: dto.url,
      eventCode: dto.eventCode,
      ...(dto.secret !== undefined && { secret: dto.secret }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
  }

  async deleteWebhook(tenantId: string, webhookId: string) {
    const webhook = await this.webhookRepo.findById(tenantId, webhookId);
    if (!webhook) throw new NotFoundError('Webhook not found');

    await this.webhookRepo.remove(tenantId, webhookId);
    return { id: webhookId, deleted: true };
  }

  async listWebhookDeliveries(tenantId: string, webhookId: string) {
    const webhook = await this.webhookRepo.findById(tenantId, webhookId);
    if (!webhook) throw new NotFoundError('Webhook not found');

    const deliveries = await this.webhookRepo.findDeliveries(webhookId);
    return {
      items: deliveries,
      meta: { total: deliveries.length, page: 1, limit: deliveries.length },
    };
  }

  async listWebhooks(tenantId: string) {
    const webhooks = await this.webhookRepo.findByTenant(tenantId);
    return {
      items: webhooks.map(webhook => this.withLegacyNotice(webhook)),
      meta: { total: webhooks.length, page: 1, limit: webhooks.length },
    };
  }

  async getWebhook(tenantId: string, webhookId: string) {
    const webhook = await this.webhookRepo.findById(tenantId, webhookId);
    if (!webhook) throw new NotFoundError('Webhook not found');
    return webhook;
  }

  async testWebhook(tenantId: string, webhookId: string) {
    const webhook = await this.webhookRepo.findById(tenantId, webhookId);
    if (!webhook || webhook.deletedAt) throw new NotFoundError('Webhook not found');

    const payload = {
      test: true,
    };
    const id = await this.outbox.createEvent({
      tenantId, eventType: webhook.eventCode, payload, targetWebhookId: webhook.id,
    });
    return { id, status: 'accepted' };
  }

  async replayDead(tenantId: string, webhookId: string, deliveryId: string) {
    const replayed = await this.outbox.replayDead(tenantId, webhookId, deliveryId);
    if (!replayed) throw new NotFoundError('Dead webhook delivery not found');
    return { id: deliveryId, status: 'pending' };
  }

  async updateWebhook(tenantId: string, webhookId: string, dto: UpdateWebhookDto) {
    const webhook = await this.webhookRepo.findById(tenantId, webhookId);
    if (!webhook || webhook.deletedAt) throw new NotFoundError('Webhook not found');

    if (dto.url) {
      await this.destinationPolicy.validateNewUrl(dto.url);
    }

    return this.webhookRepo.update(tenantId, webhookId, {
      ...(dto.url !== undefined && { url: dto.url }),
      ...(dto.eventCode !== undefined && { eventCode: dto.eventCode }),
      ...(dto.secret !== undefined && { secret: dto.secret }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
  }

  private withLegacyNotice(webhook: WebhookView) {
    const legacyHttp = new URL(webhook.url).protocol === 'http:';
    return {
      ...webhook,
      legacyHttp: legacyHttp ? {
        deadlineAt: this.destinationPolicy.legacyHttpDeadline(webhook.createdAt)?.toISOString() ?? null,
        canDeliver: this.destinationPolicy.allowsLegacyHttp(webhook.createdAt),
      } : null,
    };
  }
}
