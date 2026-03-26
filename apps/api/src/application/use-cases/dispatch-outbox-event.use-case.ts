import { Inject, Injectable } from '@nestjs/common';
import { WEBHOOK_REPOSITORY, IWebhookRepository } from '../../core/repositories/webhook.repository';
import { WEBHOOK_DISPATCHER, IWebhookDispatcher } from '../ports/webhook-dispatcher.port';

@Injectable()
export class DispatchOutboxEventUseCase {
  constructor(
    @Inject(WEBHOOK_REPOSITORY) private readonly webhookRepo: IWebhookRepository,
    @Inject(WEBHOOK_DISPATCHER) private readonly dispatcher: IWebhookDispatcher,
  ) {}

  async execute(event: {
    id: string;
    tenantId: string;
    eventType: string;
    payload: unknown;
    attempts: number;
  }) {
    const configured = await this.webhookRepo.findActiveByEvent(
      event.tenantId,
      event.eventType,
    );

    for (const webhook of configured) {
      await this.dispatcher.dispatch(
        webhook.id,
        webhook.url,
        webhook.secret,
        {
          eventType: event.eventType,
          tenantId: event.tenantId,
          payload: event.payload,
          outboxEventId: event.id,
          sentAt: new Date().toISOString(),
        },
        event.id,
      );
    }
  }
}
