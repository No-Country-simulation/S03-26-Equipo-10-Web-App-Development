import { ConflictError, NotFoundError } from '../../../common/errors/application.error';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { pageOffset, type AdminPage } from '../../../common/pagination/admin-page';

export interface WebhookView {
  id: string;
  tenantId: string;
  url: string;
  eventCode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  hasSignature: boolean;
  signatureGraceUntil: Date | null;
}

export interface WebhookDeliveryView {
  id: string;
  webhookId: string;
  outboxEventId: string | null;
  status: string;
  attempts: number;
  responseCode: number | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  attemptHistory: Array<{
    attemptNo: number;
    status: string;
    responseCode: number | null;
    errorMessage: string | null;
    startedAt: Date;
    completedAt: Date | null;
  }>;
}

export interface WebhookWithSecret extends WebhookView {
  secret: string | null;
  secretCiphertext: string | null;
  secretKeyVersion: number | null;
  previousSecretCiphertext: string | null;
  previousSecretKeyVersion: number | null;
  previousSecretValidUntil: Date | null;
}

@Injectable()
export class WebhookRepository {
  constructor(private readonly prisma: PrismaService) {}

  private view(w: {
    id: string; tenantId: string; url: string; isActive: boolean; createdAt: Date;
    updatedAt: Date; deletedAt: Date | null; secret: string | null;
    secretCiphertext: string | null; previousSecretValidUntil: Date | null;
    event: { code: string };
  }): WebhookView {
    return {
      id: w.id, tenantId: w.tenantId, url: w.url, eventCode: w.event.code,
      isActive: w.isActive, createdAt: w.createdAt, updatedAt: w.updatedAt,
      deletedAt: w.deletedAt, hasSignature: !!(w.secretCiphertext || w.secret),
      signatureGraceUntil: w.previousSecretValidUntil,
    };
  }

  async findByTenant(tenantId: string, page: AdminPage = { page: 1, limit: 20 }): Promise<{ items: WebhookView[]; total: number }> {
    const [webhooks, total] = await Promise.all([this.prisma.webhook.findMany({
      where: { tenantId },
      include: { event: true },
      orderBy: { createdAt: 'desc' },
      skip: pageOffset(page), take: page.limit,
    }), this.prisma.webhook.count({ where: { tenantId } })]);

    return { items: webhooks.map(w => this.view(w)), total };
  }

  async findById(tenantId: string, webhookId: string): Promise<WebhookView | null> {
    const w = await this.prisma.webhook.findFirst({
      where: { id: webhookId, tenantId },
      include: { event: true },
    });

    if (!w) return null;

    return this.view(w);
  }

  findSigningMaterial(tenantId: string, webhookId: string) {
    return this.prisma.webhook.findFirst({
      where: { id: webhookId, tenantId, deletedAt: null },
      select: { id: true, tenantId: true, createdAt: true, updatedAt: true, secret: true,
        secretCiphertext: true, secretKeyVersion: true, previousSecretValidUntil: true },
    });
  }

  async create(params: {
    id: string;
    tenantId: string;
    url: string;
    eventCode: string;
    secretCiphertext: string;
    secretKeyVersion: number;
    isActive?: boolean;
  }): Promise<WebhookView> {
    const event = await this.prisma.webhookEvent.findUnique({ where: { code: params.eventCode } });
    if (!event) throw new NotFoundError('Webhook event not found');

    const created = await this.prisma.webhook.create({
      data: {
        id: params.id,
        tenantId: params.tenantId,
        url: params.url,
        eventId: event.id,
        secret: null,
        secretCiphertext: params.secretCiphertext,
        secretKeyVersion: params.secretKeyVersion,
        isActive: params.isActive ?? true,
      },
      include: { event: true },
    });

    return this.view(created);
  }

  async update(tenantId: string, webhookId: string, params: {
    url?: string;
    eventCode?: string;
    isActive?: boolean;
  }): Promise<WebhookView> {
    let eventId: number | undefined;
    if (params.eventCode) {
      const event = await this.prisma.webhookEvent.findUnique({ where: { code: params.eventCode } });
      if (!event) throw new NotFoundError('Webhook event not found');
      eventId = event.id;
    }

    const updated = await this.prisma.webhook.update({
      where: { id: webhookId, tenantId },
      data: {
        ...(params.url !== undefined && { url: params.url }),
        ...(params.isActive !== undefined && { isActive: params.isActive }),
        ...(eventId !== undefined && { eventId }),
      },
      include: { event: true },
    });

    return this.view(updated);
  }

  async rotateSecret(params: {
    tenantId: string; webhookId: string; expectedUpdatedAt: Date;
    ciphertext: string; keyVersion: number;
    previousCiphertext: string | null; previousKeyVersion: number | null;
    graceUntil: Date | null;
  }): Promise<WebhookView> {
    const changed = await this.prisma.webhook.updateMany({
      where: { id: params.webhookId, tenantId: params.tenantId,
        updatedAt: params.expectedUpdatedAt, deletedAt: null },
      data: {
        secret: null, secretCiphertext: params.ciphertext, secretKeyVersion: params.keyVersion,
        previousSecretCiphertext: params.previousCiphertext,
        previousSecretKeyVersion: params.previousKeyVersion,
        previousSecretValidUntil: params.graceUntil,
      },
    });
    if (changed.count !== 1) throw new ConflictError('Webhook changed during secret rotation');
    const updated = await this.findById(params.tenantId, params.webhookId);
    if (!updated) throw new NotFoundError('Webhook not found');
    return updated;
  }

  async suspendExpiredUnsigned(startedAt: Date): Promise<number> {
    const result = await this.prisma.webhook.updateMany({
      where: { createdAt: { lte: startedAt }, isActive: true, deletedAt: null,
        secret: null, secretCiphertext: null },
      data: { isActive: false },
    });
    return result.count;
  }

  async suspendExpiredHttp(startedAt: Date): Promise<number> {
    const result = await this.prisma.webhook.updateMany({
      where: { createdAt: { lte: startedAt }, url: { startsWith: 'http://', mode: 'insensitive' },
        isActive: true, deletedAt: null },
      data: { isActive: false },
    });
    return result.count;
  }

  async remove(tenantId: string, webhookId: string): Promise<void> {
    await this.prisma.webhook.update({
      where: { id: webhookId, tenantId },
      data: { isActive: false, deletedAt: new Date() },
    });
  }

  async findDeliveries(webhookId: string, page: AdminPage = { page: 1, limit: 20 }): Promise<{ items: WebhookDeliveryView[]; total: number }> {
    const [deliveries, total] = await Promise.all([this.prisma.webhookDelivery.findMany({
      where: { webhookId },
      include: { attemptHistory: { orderBy: { startedAt: 'desc' }, take: 20 } },
      orderBy: { createdAt: 'desc' },
      skip: pageOffset(page), take: page.limit,
    }), this.prisma.webhookDelivery.count({ where: { webhookId } })]);

    return { items: deliveries.map((d) => ({
      id: d.id,
      webhookId: d.webhookId,
      outboxEventId: d.outboxEventId,
      status: d.status,
      attempts: d.attempts,
      responseCode: d.responseCode,
      errorMessage: d.errorMessage,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      attemptHistory: d.attemptHistory.map(attempt => ({
        attemptNo: attempt.attemptNo,
        status: attempt.status,
        responseCode: attempt.responseCode,
        errorMessage: attempt.errorMessage,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
      })),
    })), total };
  }

}
