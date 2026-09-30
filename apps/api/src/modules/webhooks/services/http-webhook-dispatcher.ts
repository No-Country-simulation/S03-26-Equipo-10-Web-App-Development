import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';

import { HttpResilienceService } from './http-resilience.service';
import { LoggerService } from './logger.service';
import { WebhookRepository } from '../repositories/webhook.repository';
import type { WebhookWithSecret } from '../repositories/webhook.repository';
import { WebhookDestinationPolicy } from './webhook-destination-policy';

@Injectable()
export class HttpWebhookDispatcher {
  constructor(
    private readonly http: HttpResilienceService,
    private readonly logger: LoggerService,
    private readonly webhookRepo: WebhookRepository,
    private readonly destinationPolicy: WebhookDestinationPolicy,
  ) {}

  async dispatch(
    webhook: WebhookWithSecret,
    payload: Record<string, unknown>,
    outboxEventId?: string,
  ): Promise<void> {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'testimonial-cms-webhook-dispatcher',
    };

    if (webhook.secret) {
      const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');
      headers['X-Signature'] = signature;
    }

    try {
      const legacyHttp = new URL(webhook.url).protocol === 'http:';
      const allowLegacyHttp = legacyHttp && this.destinationPolicy.allowsLegacyHttp(webhook.createdAt);
      if (legacyHttp) {
        this.logger.warn('Legacy HTTP webhook destination used', {
          webhookId: webhook.id,
          tenantId: webhook.tenantId,
          deadlineAt: this.destinationPolicy.legacyHttpDeadline(webhook.createdAt)?.toISOString() ?? null,
          allowed: allowLegacyHttp,
        });
      }
      const response = await this.http.postText(webhook.url, body, headers, {
        circuitKey: `webhook:${webhook.id}`,
        timeoutMs: 5000,
        retries: 2,
        allowLegacyHttp,
      });

      await this.webhookRepo.createDelivery({
        webhookId: webhook.id,
        ...(outboxEventId !== undefined && { outboxEventId }),
        status: response.status >= 200 && response.status < 300 ? 'success' : 'failed',
        attempts: 1,
        responseCode: response.status,
        responseBody: response.body,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected delivery error';
      this.logger.warn('Webhook delivery failed', { webhookId: webhook.id, outboxEventId, message });

      await this.webhookRepo.createDelivery({
        webhookId: webhook.id,
        ...(outboxEventId !== undefined && { outboxEventId }),
        status: 'failed',
        attempts: 1,
        errorMessage: message,
      });
    }
  }
}
