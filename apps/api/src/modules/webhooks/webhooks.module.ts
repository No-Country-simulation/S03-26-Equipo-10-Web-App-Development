import { Module } from '@nestjs/common';

import { WebhooksController } from './controllers/webhooks.controller';
import { WebhooksService } from './services/webhooks.service';
import { WebhookOutboxHandler, WebhooksBootstrapService } from './services/webhook-outbox-handler.service';
import { OutboxService } from './services/outbox.service';
import { OutboxProcessor } from './services/outbox.processor';
import { HttpWebhookDispatcher } from './services/http-webhook-dispatcher';
import { HttpResilienceService } from './services/http-resilience.service';
import { LoggerService } from './services/logger.service';

import { WebhookRepository } from './repositories/webhook.repository';

@Module({
  controllers: [WebhooksController],
  providers: [
    WebhookRepository,
    HttpWebhookDispatcher,
    HttpResilienceService,
    LoggerService,
    OutboxService,
    OutboxProcessor,
    WebhookOutboxHandler,
    WebhooksBootstrapService,
    WebhooksService,
  ],
  exports: [WebhookOutboxHandler, WebhooksService, OutboxService, WebhookRepository, HttpWebhookDispatcher],
})
export class WebhooksModule {}


