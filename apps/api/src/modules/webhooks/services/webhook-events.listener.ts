import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OutboxService } from './outbox.service';

/** Tipo semántico para eventos internos de webhook emitidos via EventEmitter2. */
interface WebhookDomainEvent {
  readonly tenantId: string;
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
}

@Injectable()
export class WebhookEventsListener {
  constructor(private readonly outbox: OutboxService) {}

  @OnEvent('testimonial.created')
  async handleTestimonialCreated(event: WebhookDomainEvent) {
    await this.outbox.createEvent({
      tenantId: event.tenantId,
      eventType: event.eventType,
      payload: event.payload,
    });
  }

  @OnEvent('testimonial.published')
  async handleTestimonialPublished(event: WebhookDomainEvent) {
    await this.outbox.createEvent({
      tenantId: event.tenantId,
      eventType: event.eventType,
      payload: event.payload,
    });
  }
}
