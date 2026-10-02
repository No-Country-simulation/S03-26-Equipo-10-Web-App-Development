import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { HttpResilienceService } from './http-resilience.service';
import { LoggerService } from './logger.service';
import type { WebhookWithSecret } from '../repositories/webhook.repository';
import type { DeliveryResult } from '../repositories/outbox.repository';
import { WebhookDestinationPolicy } from './webhook-destination-policy';
import { WebhookSecretService } from './webhook-secret.service';
import { signWebhookBody } from '../utils/webhook-signature';
import { redactDeliveryText } from '../utils/redact-delivery-text';

@Injectable()
export class HttpWebhookDispatcher {
  constructor(
    private readonly http: HttpResilienceService,
    private readonly logger: LoggerService,
    private readonly destinationPolicy: WebhookDestinationPolicy,
    private readonly secrets: WebhookSecretService,
  ) {}

  /** Una invocación equivale a exactamente un intento de transporte. */
  async dispatch(
    webhook: WebhookWithSecret,
    payload: Record<string, unknown>,
    outboxEventId: string,
  ): Promise<DeliveryResult> {
    const body = JSON.stringify(payload);
    const bodyBytes = Buffer.from(body, 'utf8');
    const signingSecret = webhook.secretCiphertext && webhook.secretKeyVersion
      ? this.secrets.decrypt(webhook.tenantId, webhook.id, {
        ciphertext: webhook.secretCiphertext, keyVersion: webhook.secretKeyVersion,
      }) : webhook.secret;
    const previousSecret = webhook.previousSecretCiphertext && webhook.previousSecretKeyVersion &&
      webhook.previousSecretValidUntil && webhook.previousSecretValidUntil.getTime() > Date.now()
      ? this.secrets.decrypt(webhook.tenantId, webhook.id, {
        ciphertext: webhook.previousSecretCiphertext, keyVersion: webhook.previousSecretKeyVersion,
      }) : null;
    if (!signingSecret && !this.secrets.legacyAllowed(webhook.createdAt)) {
      return { status: 410, errorMessage: 'Unsigned webhook destination suspended' };
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'testimonial-cms-webhook-dispatcher',
      'X-TMS-Event-Id': outboxEventId,
      'X-TMS-Schema-Version': '1',
    };
    if (signingSecret) {
      const signatures = [signWebhookBody(bodyBytes, timestamp, signingSecret)];
      if (previousSecret) signatures.push(signWebhookBody(bodyBytes, timestamp, previousSecret));
      headers['X-TMS-Signature'] = `t=${timestamp},${signatures.map(value => `v1=${value}`).join(',')}`;
      if (this.secrets.legacyAllowed(webhook.createdAt)) {
        headers['X-Signature'] = createHmac('sha256', previousSecret ?? signingSecret)
          .update(bodyBytes).digest('hex');
      }
    } else {
      this.logger.warn('Unsigned legacy webhook destination used', {
        webhookId: webhook.id, tenantId: webhook.tenantId,
        deadlineAt: this.secrets.legacyDeadline(webhook.createdAt)?.toISOString() ?? null,
      });
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
      return { status: response.status,
        body: redactDeliveryText(response.body, [signingSecret ?? '', previousSecret ?? '']) ?? '' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected delivery error';
      const redacted = redactDeliveryText(message, [signingSecret ?? '', previousSecret ?? ''])
        ?? 'Unexpected delivery error';
      this.logger.warn('Webhook transport failed', { webhookId: webhook.id, outboxEventId, message: redacted });
      return { status: null, errorMessage: redacted };
    }
  }
}
