import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { IWebhookDispatcher } from '../interfaces/webhook-dispatcher.port';
import { HttpResilienceService } from './http-resilience.service';
import { LoggerService } from './logger.service';
import { WEBHOOK_REPOSITORY, IWebhookRepository } from '../repositories/webhook.repository';

@Injectable()
export class HttpWebhookDispatcher implements IWebhookDispatcher {
  constructor(
    private readonly http: HttpResilienceService,
    private readonly logger: LoggerService,
    @Inject(WEBHOOK_REPOSITORY) private readonly webhookRepo: IWebhookRepository,
  ) {}

  async dispatch(
    webhookId: string,
    url: string,
    secret: string | null,
    payload: Record<string, unknown>,
    outboxEventId?: string,
  ): Promise<void> {
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

      await this.webhookRepo.createDelivery({
        webhookId,
        outboxEventId,
        status: response.status >= 200 && response.status < 300 ? 'success' : 'failed',
        attempts: 1,
        responseCode: response.status,
        responseBody: response.body,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected delivery error';
      this.logger.warn('Webhook delivery failed', { webhookId, outboxEventId, message });

      await this.webhookRepo.createDelivery({
        webhookId,
        outboxEventId,
        status: 'failed',
        attempts: 1,
        errorMessage: message,
      });
    }
  }
}
