import { Module } from '@nestjs/common';
import { HttpResilienceService } from '../../infrastructure/external/http-resilience.service';
import { LoggerService } from '../../infrastructure/logging/logger.service';
import { OutboxProcessor } from '../../infrastructure/outbox/outbox.processor';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { WebhooksService } from './application/services/webhooks.service';
import { WebhookOutboxHandler, WebhooksBootstrapService } from './application/services/webhook-outbox-handler.service';
import { WebhooksController } from './presentation/controllers/webhooks.controller';

@Module({
  controllers: [WebhooksController],
  providers: [
    HttpResilienceService,
    LoggerService,
    OutboxService,
    OutboxProcessor,
    WebhooksService,
    WebhookOutboxHandler,
    WebhooksBootstrapService,
  ],
  exports: [WebhooksService],
})
export class WebhooksModule {}
