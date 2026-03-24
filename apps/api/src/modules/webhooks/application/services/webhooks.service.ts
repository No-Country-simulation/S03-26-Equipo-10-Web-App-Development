import { Injectable, NotFoundException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../../../../prisma/prisma.service';
import { HttpResilienceService } from '../../../../infrastructure/external/http-resilience.service';
import { LoggerService } from '../../../../infrastructure/logging/logger.service';
import { CreateWebhookDto, UpdateWebhookDto } from '../dto/webhook.dto';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpResilienceService,
    private readonly logger: LoggerService,
  ) {}

  async listWebhooks(tenantId: string) {
    const webhooks = await this.prisma.webhook.findMany({
      where: { tenantId },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: webhooks.map(webhook => ({
        id: webhook.id,
        tenantId: webhook.tenantId,
        url: webhook.url,
        eventCode: webhook.event.code,
        isActive: webhook.isActive,
        createdAt: webhook.createdAt,
        updatedAt: webhook.updatedAt,
      })),
      meta: {
        total: webhooks.length,
        page: 1,
        limit: webhooks.length,
      },
    };
  }

  async createWebhook(tenantId: string, dto: CreateWebhookDto) {
    const event = await this.prisma.webhookEvent.findUnique({ where: { code: dto.eventCode } });
    if (!event) {
      throw new NotFoundException('Webhook event not found');
    }

    const created = await this.prisma.webhook.create({
      data: {
        tenantId,
        url: dto.url,
        eventId: event.id,
        secret: dto.secret,
        isActive: dto.isActive ?? true,
      },
      include: { event: true },
    });

    return {
      id: created.id,
      tenantId: created.tenantId,
      url: created.url,
      eventCode: created.event.code,
      isActive: created.isActive,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  async updateWebhook(tenantId: string, webhookId: string, dto: UpdateWebhookDto) {
    const webhook = await this.prisma.webhook.findFirst({ where: { id: webhookId, tenantId } });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    let eventId: number | undefined;
    if (dto.eventCode) {
      const event = await this.prisma.webhookEvent.findUnique({ where: { code: dto.eventCode } });
      if (!event) {
        throw new NotFoundException('Webhook event not found');
      }
      eventId = event.id;
    }

    const updated = await this.prisma.webhook.update({
      where: { id: webhookId },
      data: {
        url: dto.url,
        secret: dto.secret,
        isActive: dto.isActive,
        eventId,
      },
      include: { event: true },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      url: updated.url,
      eventCode: updated.event.code,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteWebhook(tenantId: string, webhookId: string) {
    const webhook = await this.prisma.webhook.findFirst({ where: { id: webhookId, tenantId } });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    await this.prisma.webhook.delete({ where: { id: webhookId } });
    return { id: webhookId, deleted: true };
  }

  async listDeliveries(tenantId: string, webhookId: string) {
    const webhook = await this.prisma.webhook.findFirst({ where: { id: webhookId, tenantId } });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return {
      items: deliveries.map(delivery => ({
        id: delivery.id,
        webhookId: delivery.webhookId,
        outboxEventId: delivery.outboxEventId,
        status: delivery.status,
        attempts: delivery.attempts,
        responseCode: delivery.responseCode,
        errorMessage: delivery.errorMessage,
        createdAt: delivery.createdAt,
        updatedAt: delivery.updatedAt,
      })),
      meta: {
        total: deliveries.length,
        page: 1,
        limit: deliveries.length,
      },
    };
  }

  async testWebhook(tenantId: string, webhookId: string) {
    const webhook = await this.prisma.webhook.findFirst({
      where: { id: webhookId, tenantId },
      include: { event: true },
    });

    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const payload = {
      eventType: webhook.event.code,
      tenantId,
      test: true,
      sentAt: new Date().toISOString(),
    };

    return this.dispatch(webhook.id, webhook.url, webhook.secret, payload, undefined);
  }

  async dispatchOutboxEvent(event: {
    id: string;
    tenantId: string;
    eventType: string;
    payload: unknown;
    attempts: number;
  }) {
    const configured = await this.prisma.webhook.findMany({
      where: {
        tenantId: event.tenantId,
        isActive: true,
        event: { code: event.eventType },
      },
      include: { event: true },
    });

    for (const webhook of configured) {
      await this.dispatch(
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

  private async dispatch(
    webhookId: string,
    url: string,
    secret: string | null,
    payload: Record<string, unknown>,
    outboxEventId: string | undefined,
  ) {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'testimonial-cms-webhook-dispatcher',
    };

    if (secret) {
      const signature = createHmac('sha256', secret).update(body).digest('hex');
      headers['X-Signature'] = signature;
    }

    try {
      const response = await this.http.postText(url, body, headers, {
        circuitKey: `webhook:${webhookId}`,
        timeoutMs: 5000,
        retries: 2,
      });

      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          webhookId,
          outboxEventId,
          status: response.status >= 200 && response.status < 300 ? 'success' : 'failed',
          attempts: 1,
          responseCode: response.status,
          responseBody: response.body,
        },
      });

      return {
        id: delivery.id,
        status: delivery.status,
        responseCode: delivery.responseCode,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected delivery error';

      const delivery = await this.prisma.webhookDelivery.create({
        data: {
          webhookId,
          outboxEventId,
          status: 'failed',
          attempts: 1,
          errorMessage: message,
        },
      });

      this.logger.warn('Webhook delivery failed', {
        webhookId,
        outboxEventId,
        message,
      });

      return {
        id: delivery.id,
        status: delivery.status,
        responseCode: delivery.responseCode,
      };
    }
  }
}

