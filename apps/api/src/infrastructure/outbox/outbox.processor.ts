import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { LoggerService } from '../logging/logger.service';
import { OutboxService } from './outbox.service';

export interface OutboxHandler {
  handle(event: {
    id: string;
    tenantId: string;
    eventType: string;
    payload: unknown;
    attempts: number;
  }): Promise<void>;
}

@Injectable()
export class OutboxProcessor implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private readonly intervalMs = 3000;

  constructor(
    private readonly outboxService: OutboxService,
    private readonly logger: LoggerService,
  ) {}

  setHandler(handler: OutboxHandler) {
    this.handler = handler;
  }

  private handler?: OutboxHandler;

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.process();
    }, this.intervalMs);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async process(): Promise<void> {
    if (!this.handler) {
      return;
    }

    const events = await this.outboxService.acquirePending();
    for (const event of events) {
      try {
        await this.handler.handle({
          id: event.id,
          tenantId: event.tenantId,
          eventType: event.eventType,
          payload: event.payload,
          attempts: event.attempts,
        });

        await this.outboxService.markProcessed(event.id);
      } catch (error) {
        await this.outboxService.markFailed(
          event.id,
          event.attempts + 1,
          error instanceof Error ? error.message : 'Unknown outbox failure',
        );

        this.logger.warn('Outbox delivery failed', {
          outboxEventId: event.id,
          eventType: event.eventType,
          attempts: event.attempts + 1,
        });
      }
    }
  }
}
