import { ConflictError, NotFoundError } from '../../../common/errors/application.error';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { WebhookRepository } from '../repositories/webhook.repository';
import { CreateWebhookDto, UpdateWebhookDto } from '../dto/webhook.dto';
import { WebhookDestinationPolicy } from './webhook-destination-policy';
import type { WebhookView } from '../repositories/webhook.repository';
import { OutboxRepository } from '../repositories/outbox.repository';
import { WebhookSecretService } from './webhook-secret.service';
import type { AdminPage } from '../../../common/pagination/admin-page';

@Injectable()
export class WebhooksService {
  constructor(
    private readonly webhookRepo: WebhookRepository,
    private readonly outbox: OutboxRepository,
    private readonly destinationPolicy: WebhookDestinationPolicy,
    private readonly secrets: WebhookSecretService,
  ) {}

  async createWebhook(tenantId: string, dto: CreateWebhookDto) {
    await this.destinationPolicy.validateNewUrl(dto.url);
    const id = randomUUID();
    const signingSecret = this.secrets.issue();
    const encrypted = this.secrets.encrypt(tenantId, id, signingSecret);
    const created = await this.webhookRepo.create({
      id,
      tenantId,
      url: dto.url,
      eventCode: dto.eventCode,
      secretCiphertext: encrypted.ciphertext,
      secretKeyVersion: encrypted.keyVersion,
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    return { ...created, signingSecret };
  }

  async deleteWebhook(tenantId: string, webhookId: string) {
    const webhook = await this.webhookRepo.findById(tenantId, webhookId);
    if (!webhook) throw new NotFoundError('Webhook not found');

    await this.webhookRepo.remove(tenantId, webhookId);
    return { id: webhookId, deleted: true };
  }

  async listWebhookDeliveries(tenantId: string, webhookId: string, page: AdminPage = { page: 1, limit: 20 }) {
    const webhook = await this.webhookRepo.findById(tenantId, webhookId);
    if (!webhook) throw new NotFoundError('Webhook not found');

    const deliveries = await this.webhookRepo.findDeliveries(webhookId, page);
    return {
      items: deliveries.items,
      meta: { total: deliveries.total, page: page.page, limit: page.limit },
    };
  }

  async listWebhooks(tenantId: string, page: AdminPage = { page: 1, limit: 20 }) {
    const webhooks = await this.webhookRepo.findByTenant(tenantId, page);
    return {
      items: webhooks.items.map(webhook => this.withLegacyNotice(webhook)),
      meta: { total: webhooks.total, page: page.page, limit: page.limit },
    };
  }

  async getWebhook(tenantId: string, webhookId: string) {
    const webhook = await this.webhookRepo.findById(tenantId, webhookId);
    if (!webhook) throw new NotFoundError('Webhook not found');
    return this.withLegacyNotice(webhook);
  }

  async testWebhook(tenantId: string, webhookId: string) {
    const webhook = await this.webhookRepo.findById(tenantId, webhookId);
    if (!webhook || webhook.deletedAt || !webhook.isActive) throw new NotFoundError('Webhook not found');

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
    if (dto.isActive && !webhook.hasSignature &&
      !this.secrets.legacyAllowed(webhook.createdAt)) {
      throw new ConflictError('Unsigned webhook must rotate its secret before activation');
    }
    if (dto.isActive && !dto.url && webhook.url.startsWith('http://') &&
      !this.destinationPolicy.allowsLegacyHttp(webhook.createdAt)) {
      throw new ConflictError('HTTP webhook must use HTTPS before activation');
    }

    const updated = await this.webhookRepo.update(tenantId, webhookId, {
      ...(dto.url !== undefined && { url: dto.url }),
      ...(dto.eventCode !== undefined && { eventCode: dto.eventCode }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });
    return this.withLegacyNotice(updated);
  }

  async rotateSecret(tenantId: string, webhookId: string) {
    const current = await this.webhookRepo.findSigningMaterial(tenantId, webhookId);
    if (!current) throw new NotFoundError('Webhook not found');
    if (current.previousSecretValidUntil && current.previousSecretValidUntil > new Date()) {
      throw new ConflictError('Previous webhook secret is still in its grace period');
    }
    const oldSecret = current.secretCiphertext && current.secretKeyVersion
      ? this.secrets.decrypt(tenantId, webhookId, {
        ciphertext: current.secretCiphertext, keyVersion: current.secretKeyVersion,
      }) : current.secret;
    const signingSecret = this.secrets.issue();
    const encrypted = this.secrets.encrypt(tenantId, webhookId, signingSecret);
    const previous = oldSecret ? this.secrets.encrypt(tenantId, webhookId, oldSecret) : null;
    const graceUntil = previous ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;
    const updated = await this.webhookRepo.rotateSecret({
      tenantId, webhookId, expectedUpdatedAt: current.updatedAt,
      ciphertext: encrypted.ciphertext, keyVersion: encrypted.keyVersion,
      previousCiphertext: previous?.ciphertext ?? null,
      previousKeyVersion: previous?.keyVersion ?? null,
      graceUntil,
    });
    return { ...this.withLegacyNotice(updated), signingSecret };
  }

  private withLegacyNotice(webhook: WebhookView) {
    const legacyHttp = new URL(webhook.url).protocol === 'http:';
    return {
      ...webhook,
      legacyHttp: legacyHttp ? {
        deadlineAt: this.destinationPolicy.legacyHttpDeadline(webhook.createdAt)?.toISOString() ?? null,
        canDeliver: this.destinationPolicy.allowsLegacyHttp(webhook.createdAt),
      } : null,
      legacyUnsigned: !webhook.hasSignature ? {
        deadlineAt: this.secrets.legacyDeadline(webhook.createdAt)?.toISOString() ?? null,
        canDeliver: this.secrets.legacyAllowed(webhook.createdAt),
      } : null,
      legacySignatureUntil: webhook.hasSignature && this.secrets.legacyAllowed(webhook.createdAt)
        ? this.secrets.legacyDeadline(webhook.createdAt)?.toISOString() ?? null : null,
    };
  }
}
