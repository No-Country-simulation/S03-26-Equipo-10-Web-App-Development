import { Injectable, OnModuleInit } from '@nestjs/common';
import { OutboxProcessor, type OutboxHandler } from '../../../../infrastructure/outbox/outbox.processor';
import { WebhooksService } from './webhooks.service';

@Injectable()
export class WebhookOutboxHandler implements OutboxHandler {
  constructor(private readonly webhooksService: WebhooksService) {}

  async handle(event: {
    id: string;
    tenantId: string;
    eventType: string;
    payload: unknown;
    attempts: number;
  }): Promise<void> {
    await this.webhooksService.dispatchOutboxEvent(event);
  }
}

@Injectable()
export class WebhooksBootstrapService implements OnModuleInit {
  constructor(
    private readonly outboxProcessor: OutboxProcessor,
    private readonly outboxHandler: WebhookOutboxHandler,
  ) {}

  onModuleInit(): void {
    this.outboxProcessor.setHandler(this.outboxHandler);
  }
}
