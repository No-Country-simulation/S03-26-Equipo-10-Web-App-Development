import { Module } from '@nestjs/common';

import { WebhooksController } from './controllers/webhooks.controller';
import { WebhooksService } from './services/webhooks.service';
import { OutboxRepository } from './repositories/outbox.repository';
import { OutboxProcessor } from './services/outbox.processor';
import { HttpWebhookDispatcher } from './services/http-webhook-dispatcher';
import { HttpResilienceService } from './services/http-resilience.service';
import { WebhookDestinationPolicy } from './services/webhook-destination-policy';
import { LoggerService } from './services/logger.service';
import { WebhookEventsListener } from './services/webhook-events.listener';

import { WebhookRepository } from './repositories/webhook.repository';

@Module({
  controllers: [WebhooksController],
  providers: [
    WebhookRepository,
    HttpWebhookDispatcher,
    HttpResilienceService,
    WebhookDestinationPolicy,
    LoggerService,
    OutboxRepository,
    OutboxProcessor,
    WebhooksService,
    WebhookEventsListener,
  ],
  exports: [HttpResilienceService],
})
export class WebhooksModule {}
