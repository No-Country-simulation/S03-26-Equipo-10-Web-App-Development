import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { HttpResilienceService } from './http-resilience.service';
import { LoggerService } from './logger.service';
import type { WebhookWithSecret } from '../repositories/webhook.repository';
import type { DeliveryResult } from '../repositories/outbox.repository';
import { WebhookDestinationPolicy } from './webhook-destination-policy';

@Injectable()
export class HttpWebhookDispatcher {
  constructor(
    private readonly http: HttpResilienceService,
    private readonly logger: LoggerService,
    private readonly destinationPolicy: WebhookDestinationPolicy,
  ) {}

  /** Una invocación equivale a exactamente un intento de transporte. */
  async dispatch(
    webhook: WebhookWithSecret,
    payload: Record<string, unknown>,
    outboxEventId: string,
  ): Promise<DeliveryResult> {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'testimonial-cms-webhook-dispatcher',
      'X-TMS-Event-Id': outboxEventId,
    };
    if (webhook.secret) {
      headers['X-Signature'] = createHmac('sha256', webhook.secret).update(body).digest('hex');
    }

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
    try {
      const response = await this.http.postText(webhook.url, body, headers, {
        circuitKey: `webhook:${webhook.id}`,
        timeoutMs: 5000,
        retries: 0,
        skipCircuit: true,
        allowLegacyHttp,
      });
      return { status: response.status, body: response.body };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected delivery error';
      this.logger.warn('Webhook transport failed', { webhookId: webhook.id, outboxEventId, message });
      return { status: null, errorMessage: message };
    }
  }
}
