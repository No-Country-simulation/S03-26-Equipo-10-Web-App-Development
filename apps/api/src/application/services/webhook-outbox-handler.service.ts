import { Injectable, OnModuleInit } from '@nestjs/common';
import { OutboxProcessor, type OutboxHandler } from '../../infrastructure/database/services/outbox.processor';
import { DispatchOutboxEventUseCase } from '../use-cases/dispatch-outbox-event.use-case';

@Injectable()
export class WebhookOutboxHandler implements OutboxHandler {
  constructor(private readonly dispatchUseCase: DispatchOutboxEventUseCase) {}

  async handle(event: {
    id: string;
    tenantId: string;
    eventType: string;
    payload: unknown;
    attempts: number;
  }): Promise<void> {
    await this.dispatchUseCase.execute(event);
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
