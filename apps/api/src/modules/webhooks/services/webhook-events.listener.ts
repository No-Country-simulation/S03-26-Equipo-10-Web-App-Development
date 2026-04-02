import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OutboxService } from './outbox.service';

@Injectable()
export class WebhookEventsListener {
  constructor(private readonly outbox: OutboxService) {}

  @OnEvent('testimonial.created')
  async handleTestimonialCreated(event: { tenantId: string; eventType: string; payload: any }) {
    await this.outbox.createEvent({
      tenantId: event.tenantId,
      eventType: event.eventType,
      payload: event.payload,
    });
  }

  @OnEvent('testimonial.published')
  async handleTestimonialPublished(event: { tenantId: string; eventType: string; payload: any }) {
    await this.outbox.createEvent({
      tenantId: event.tenantId,
      eventType: event.eventType,
      payload: event.payload,
    });
  }
}
