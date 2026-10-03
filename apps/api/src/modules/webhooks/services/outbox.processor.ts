import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { OutboxRepository, type ClaimedDelivery } from '../repositories/outbox.repository';
import { HttpWebhookDispatcher } from './http-webhook-dispatcher';
import { WebhookRepository } from '../repositories/webhook.repository';
import { WebhookSecretService } from './webhook-secret.service';
import { WebhookDestinationPolicy } from './webhook-destination-policy';
import { MetricsService } from '../../../common/observability/metrics.service';

@Injectable()
export class OutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxProcessor.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly intervalMs = 3000;
  private readonly concurrency = 5;

  constructor(
    private readonly outbox: OutboxRepository,
    private readonly dispatcher: HttpWebhookDispatcher,
    private readonly webhooks: WebhookRepository,
    private readonly secrets: WebhookSecretService,
    private readonly destinationPolicy: WebhookDestinationPolicy,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.process().catch(() => {
        this.metrics?.recordOutboxPollFailure();
        this.logger.error({ event: 'outbox.poll_failed' }, 'Outbox poll failed');
      });
    }, this.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async process(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const startedAt = Date.now();
    try {
      const signatureStart = this.secrets.legacyStartedAt();
      if (signatureStart && Date.now() >= signatureStart.getTime() + 30 * 24 * 60 * 60 * 1000) {
        await this.webhooks.suspendExpiredUnsigned(signatureStart);
      }
      const httpStart = this.destinationPolicy.legacyHttpStartedAt();
      if (httpStart && Date.now() >= httpStart.getTime() + 30 * 24 * 60 * 60 * 1000) {
        await this.webhooks.suspendExpiredHttp(httpStart);
      }
      await this.outbox.initializePending(25);
      await this.outbox.recoverExpired(25);
      const claimed = await this.outbox.claimDue(this.concurrency);
      const results = await Promise.allSettled(claimed.map(claim => this.deliver(claim)));
      for (const [index, result] of results.entries()) {
        if (result.status === 'rejected') {
          this.logger.warn({
            deliveryId: claimed.at(index)?.id,
            event: 'outbox.delivery_unfinished',
          }, 'Delivery attempt could not be completed; lease will recover it');
        }
      }
      if (claimed.length) {
        this.logger.log({
          event: 'outbox.batch_completed',
          batchSize: claimed.length,
          failed: results.filter(result => result.status === 'rejected').length,
          durationMs: Date.now() - startedAt,
        }, 'Outbox batch processed');
      }
    } finally {
      this.running = false;
    }
  }

  private async deliver(claim: ClaimedDelivery): Promise<void> {
    return trace.getTracer('testimonial-cms-api').startActiveSpan('webhook.delivery', async span => {
    span.setAttributes({ 'tms.delivery_id': claim.id, 'tms.event_id': claim.outboxEventId });
    try {
    const context = await this.outbox.getDeliveryContext(claim.id);
    if (!context?.outboxEvent) {
      await this.outbox.completeAttempt(claim, { status: null, errorMessage: 'Delivery context missing' });
      return;
    }
    const webhook = {
      id: context.webhook.id,
      tenantId: context.webhook.tenantId,
      url: context.destinationUrl,
      eventCode: context.webhook.event.code,
      secret: context.webhook.secret,
      secretCiphertext: context.webhook.secretCiphertext,
      secretKeyVersion: context.webhook.secretKeyVersion,
      previousSecretCiphertext: context.webhook.previousSecretCiphertext,
      previousSecretKeyVersion: context.webhook.previousSecretKeyVersion,
      previousSecretValidUntil: context.webhook.previousSecretValidUntil,
      hasSignature: !!(context.webhook.secret || context.webhook.secretCiphertext),
      signatureGraceUntil: context.webhook.previousSecretValidUntil,
      isActive: context.webhook.isActive,
      createdAt: context.webhook.createdAt,
      updatedAt: context.webhook.updatedAt,
      deletedAt: context.webhook.deletedAt,
    };
    const event = context.outboxEvent;
    const result = await this.dispatcher.dispatch(webhook, {
      id: event.id,
      schemaVersion: 1,
      eventType: event.eventType,
      tenantId: event.tenantId,
      payload: event.payload,
      outboxEventId: event.id,
      sentAt: event.createdAt.toISOString(),
    }, event.id);
    const accepted = await this.outbox.completeAttempt(claim, result);
    if (accepted) this.metrics?.recordWebhookAttempt(result.status);
    if (!accepted) this.logger.warn({ deliveryId: claim.id }, 'Stale delivery result discarded');
    } catch (error) {
      span.recordException(new Error('Webhook delivery attempt failed'));
      throw error;
    } finally {
      span.end();
    }
    });
  }
}
