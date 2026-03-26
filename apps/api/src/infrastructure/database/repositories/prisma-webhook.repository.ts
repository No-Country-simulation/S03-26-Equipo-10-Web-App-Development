import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  IWebhookRepository,
  WebhookView,
  WebhookWithSecret,
  WebhookDeliveryView,
} from '../../../core/repositories/webhook.repository';

@Injectable()
export class PrismaWebhookRepository implements IWebhookRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string): Promise<WebhookView[]> {
    const webhooks = await this.prisma.webhook.findMany({
      where: { tenantId },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
    });

    return webhooks.map(w => ({
      id: w.id,
      tenantId: w.tenantId,
      url: w.url,
      eventCode: w.event.code,
      isActive: w.isActive,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));
  }

  async findById(tenantId: string, webhookId: string): Promise<WebhookWithSecret | null> {
    const w = await this.prisma.webhook.findFirst({
      where: { id: webhookId, tenantId },
      include: { event: true },
    });

    if (!w) return null;

    return {
      id: w.id,
      tenantId: w.tenantId,
      url: w.url,
      eventCode: w.event.code,
      secret: w.secret,
      isActive: w.isActive,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    };
  }

  async create(params: {
    tenantId: string;
    url: string;
    eventCode: string;
    secret?: string;
    isActive?: boolean;
  }): Promise<WebhookView> {
    const event = await this.prisma.webhookEvent.findUnique({ where: { code: params.eventCode } });
    if (!event) throw new NotFoundException('Webhook event not found');

    const created = await this.prisma.webhook.create({
      data: {
        tenantId: params.tenantId,
        url: params.url,
        eventId: event.id,
        secret: params.secret ?? null,
        isActive: params.isActive ?? true,
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

  async update(webhookId: string, params: {
    url?: string;
    eventCode?: string;
    secret?: string;
    isActive?: boolean;
  }): Promise<WebhookView> {
    let eventId: number | undefined;
    if (params.eventCode) {
      const event = await this.prisma.webhookEvent.findUnique({ where: { code: params.eventCode } });
      if (!event) throw new NotFoundException('Webhook event not found');
      eventId = event.id;
    }

    const updated = await this.prisma.webhook.update({
      where: { id: webhookId },
      data: {
        url: params.url,
        secret: params.secret,
        isActive: params.isActive,
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

  async remove(webhookId: string): Promise<void> {
    await this.prisma.webhook.delete({ where: { id: webhookId } });
  }

  async findDeliveries(webhookId: string): Promise<WebhookDeliveryView[]> {
    const deliveries = await this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return deliveries.map(d => ({
      id: d.id,
      webhookId: d.webhookId,
      outboxEventId: d.outboxEventId,
      status: d.status,
      attempts: d.attempts,
      responseCode: d.responseCode,
      errorMessage: d.errorMessage,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));
  }

  async createDelivery(params: {
    webhookId: string;
    outboxEventId?: string;
    status: string;
    attempts: number;
    responseCode?: number;
    responseBody?: string;
    errorMessage?: string;
  }) {
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookId: params.webhookId,
        outboxEventId: params.outboxEventId,
        status: params.status,
        attempts: params.attempts,
        responseCode: params.responseCode,
        responseBody: params.responseBody,
        errorMessage: params.errorMessage,
      },
    });

    return {
      id: delivery.id,
      status: delivery.status,
      responseCode: delivery.responseCode,
    };
  }

  async findActiveByEvent(tenantId: string, eventCode: string): Promise<WebhookWithSecret[]> {
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        tenantId,
        isActive: true,
        event: { code: eventCode },
      },
      include: { event: true },
    });

    return webhooks.map(w => ({
      id: w.id,
      tenantId: w.tenantId,
      url: w.url,
      eventCode: w.event.code,
      secret: w.secret,
      isActive: w.isActive,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));
  }
}
