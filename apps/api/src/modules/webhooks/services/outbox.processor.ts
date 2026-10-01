import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutboxRepository, type ClaimedDelivery } from '../repositories/outbox.repository';
import { HttpWebhookDispatcher } from './http-webhook-dispatcher';

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
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.process().catch(error => this.logger.error('Outbox poll failed', error));
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
      await this.outbox.initializePending(25);
      await this.outbox.recoverExpired(25);
      const claimed = await this.outbox.claimDue(this.concurrency);
      const results = await Promise.allSettled(claimed.map(claim => this.deliver(claim)));
      for (const [index, result] of results.entries()) {
        if (result.status === 'rejected') {
          this.logger.warn({
            deliveryId: claimed.at(index)?.id,
            reason: result.reason instanceof Error ? result.reason.message : 'Unknown delivery error',
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
      isActive: context.webhook.isActive,
      createdAt: context.webhook.createdAt,
      updatedAt: context.webhook.updatedAt,
      deletedAt: context.webhook.deletedAt,
    };
    const event = context.outboxEvent;
    const result = await this.dispatcher.dispatch(webhook, {
      eventType: event.eventType,
      tenantId: event.tenantId,
      payload: event.payload,
      outboxEventId: event.id,
      sentAt: event.createdAt.toISOString(),
    }, event.id);
    const accepted = await this.outbox.completeAttempt(claim, result);
    if (!accepted) this.logger.warn({ deliveryId: claim.id }, 'Stale delivery result discarded');
  }
}
