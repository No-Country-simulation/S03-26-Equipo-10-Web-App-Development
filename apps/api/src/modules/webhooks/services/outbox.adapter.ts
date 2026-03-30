import { Injectable } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { IOutboxPort, OutboxEvent } from '../interfaces/outbox.port';

@Injectable()
export class OutboxAdapter implements IOutboxPort {
  constructor(private readonly outbox: OutboxService) {}

  async emit(event: OutboxEvent): Promise<void> {
    await this.outbox.createEvent({
      tenantId: event.tenantId,
      eventType: event.eventType,
      payload: event.payload,
    });
  }
}
