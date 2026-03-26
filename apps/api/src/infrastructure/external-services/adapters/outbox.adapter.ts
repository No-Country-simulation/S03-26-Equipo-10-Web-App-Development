import { Injectable } from '@nestjs/common';
import { OutboxService } from '../../database/services/outbox.service';
import { IOutboxPort, OutboxEvent } from '../../../application/ports/outbox.port';

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
