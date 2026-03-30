import { NotFoundException, Injectable, Inject } from "@nestjs/common";
import { WebhookRepository } from "../repositories/webhook.repository";
import { CreateWebhookDto, UpdateWebhookDto } from "../dto/webhook.dto";
import { HttpWebhookDispatcher } from "./http-webhook-dispatcher";

@Injectable()
export class WebhooksService {
    async createWebhook(tenantId: string, dto: CreateWebhookDto) {
        return this.webhookRepo.create({
          tenantId,
          url: dto.url,
          eventCode: dto.eventCode,
          secret: dto.secret,
          isActive: dto.isActive,
        });
    }

    async deleteWebhook(tenantId: string, webhookId: string) {
        const webhook = await this.webhookRepo.findById(tenantId, webhookId);
        if (!webhook) throw new NotFoundException('Webhook not found');

        await this.webhookRepo.remove(webhookId);
        return { id: webhookId, deleted: true };
    }

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

        for (const webhook of configured) {
          await this.dispatcher.dispatch(
            webhook.id,
            webhook.url,
            webhook.secret,
            {
              eventType: event.eventType,
              tenantId: event.tenantId,
              payload: event.payload,
              outboxEventId: event.id,
              sentAt: new Date().toISOString(),
            },
            event.id,
          );
        }
    }

    async listWebhookDeliveries(tenantId: string, webhookId: string) {
        const webhook = await this.webhookRepo.findById(tenantId, webhookId);
        if (!webhook) throw new NotFoundException('Webhook not found');

        const deliveries = await this.webhookRepo.findDeliveries(webhookId);
        return {
          items: deliveries,
          meta: { total: deliveries.length, page: 1, limit: deliveries.length },
        };
    }

    async listWebhooks(tenantId: string) {
        const webhooks = await this.webhookRepo.findByTenant(tenantId);
        return {
          items: webhooks,
          meta: { total: webhooks.length, page: 1, limit: webhooks.length },
        };
    }

    async testWebhook(tenantId: string, webhookId: string) {
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

    async updateWebhook(tenantId: string, webhookId: string, dto: UpdateWebhookDto) {
        const webhook = await this.webhookRepo.findById(tenantId, webhookId);
        if (!webhook) throw new NotFoundException('Webhook not found');

        return this.webhookRepo.update(webhookId, {
          url: dto.url,
          eventCode: dto.eventCode,
          secret: dto.secret,
          isActive: dto.isActive,
        });
    }

    constructor(private readonly webhookRepo: WebhookRepository, private readonly dispatcher: HttpWebhookDispatcher) {
    }
}
