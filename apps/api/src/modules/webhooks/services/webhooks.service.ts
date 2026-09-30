import { NotFoundError } from '../../../common/errors/application.error';
import { Injectable, Logger } from '@nestjs/common';
import { WebhookRepository } from '../repositories/webhook.repository';
import { CreateWebhookDto, UpdateWebhookDto } from '../dto/webhook.dto';
import { HttpWebhookDispatcher } from './http-webhook-dispatcher';
import { WebhookDestinationPolicy } from './webhook-destination-policy';
import type { WebhookView } from '../repositories/webhook.repository';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly webhookRepo: WebhookRepository,
    private readonly dispatcher: HttpWebhookDispatcher,
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

  /**
   * Despacha un evento del outbox a todos los webhooks activos configurados.
   *
   * H-11: Usa Promise.allSettled para despachar en paralelo.
   * Cada webhook es independiente — un fallo no debe bloquear ni cancelar los demás.
   */
  async dispatchOutboxEvent(event: {
    id: string;
    tenantId: string;
    eventType: string;
    payload: unknown;
    attempts: number;
  }) {
    const configured = await this.webhookRepo.findActiveByEvent(
      event.tenantId,
      event.eventType,
    );

    if (configured.length === 0) return;

    const sentAt = new Date().toISOString();

    const results = await Promise.allSettled(
      configured.map((webhook) =>
        this.dispatcher.dispatch(
          webhook,
          {
            eventType: event.eventType,
            tenantId: event.tenantId,
            payload: event.payload,
            outboxEventId: event.id,
            sentAt,
          },
          event.id,
        ),
      ),
    );

    // Loguear fallos individuales sin propagar — at-least-once lo maneja el outbox
    for (const [i, result] of results.entries()) {
      if (result.status === 'rejected') {
        const webhookId = configured.at(i)?.id ?? 'unknown';
        this.logger.warn(
          { webhookId, outboxEventId: event.id, reason: result.reason },
          'Webhook dispatch failed for one endpoint',
        );
      }
    }
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
    if (!webhook) throw new NotFoundError('Webhook not found');

    const payload = {
      eventType: webhook.eventCode,
      tenantId,
      test: true,
      sentAt: new Date().toISOString(),
    };

    return this.dispatcher.dispatch(webhook, payload);
  }

  async updateWebhook(tenantId: string, webhookId: string, dto: UpdateWebhookDto) {
    const webhook = await this.webhookRepo.findById(tenantId, webhookId);
    if (!webhook) throw new NotFoundError('Webhook not found');

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
