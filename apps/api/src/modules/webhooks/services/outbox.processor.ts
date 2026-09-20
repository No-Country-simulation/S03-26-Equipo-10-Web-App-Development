import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
  private readonly logger = new Logger(OutboxProcessor.name);
  private timer?: NodeJS.Timeout;
  private readonly intervalMs = 3000;
  private handler?: OutboxHandler;

  constructor(private readonly outboxService: OutboxService) {}

  setHandler(handler: OutboxHandler) {
    this.handler = handler;
  }

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
    if (!this.handler) return;

    const events = await this.outboxService.acquirePending();
    if (events.length === 0) return;

    // OBS-F7: Métricas de saturación del batch — detecta atasco del outbox (OBS-10)
    const startTime = Date.now();
    let processed = 0;
    let failed = 0;

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
        processed++;
      } catch (error) {
        failed++;
        await this.outboxService.markFailed(
          event.id,
          event.attempts + 1,
          error instanceof Error ? error.message : 'Unknown outbox failure',
        );

        this.logger.warn(
          {
            event: 'outbox.delivery_failed',
            outboxEventId: event.id,
            eventType: event.eventType,
            tenantId: event.tenantId,
            attempts: event.attempts + 1,
            reason: error instanceof Error ? error.message : 'Unknown error',
          },
          'Outbox event delivery failed',
        );
      }
    }

    // Telemetría del ciclo de polling para detectar acumulación o atasco
    const durationMs = Date.now() - startTime;
    this.logger.log(
      {
        event: 'outbox.batch_completed',
        batchSize: events.length,
        processed,
        failed,
        durationMs,
      },
      'Outbox batch processed',
    );
  }
}
