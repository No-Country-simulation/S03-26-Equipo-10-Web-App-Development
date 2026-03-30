import { Module } from '@nestjs/common';

import { WebhooksController } from './controllers/webhooks.controller';
import { WebhooksService } from './services/webhooks.service';
import { WebhookOutboxHandler, WebhooksBootstrapService } from './services/webhook-outbox-handler.service';
import { OutboxService } from './services/outbox.service';
import { OutboxProcessor } from './services/outbox.processor';
import { HttpWebhookDispatcher } from './services/http-webhook-dispatcher';
import { HttpResilienceService } from './services/http-resilience.service';
import { LoggerService } from './services/logger.service';

import { WEBHOOK_REPOSITORY } from './repositories/webhook.repository';
import { PrismaWebhookRepository } from './repositories/prisma-webhook.repository';
import { WEBHOOK_DISPATCHER } from './interfaces/webhook-dispatcher.port';

@Module({
  controllers: [WebhooksController],
  providers: [
    { provide: WEBHOOK_REPOSITORY, useClass: PrismaWebhookRepository },
    { provide: WEBHOOK_DISPATCHER, useClass: HttpWebhookDispatcher },
    HttpResilienceService,
    LoggerService,
    OutboxService,
    OutboxProcessor,
    WebhookOutboxHandler,
    WebhooksBootstrapService,
    WebhooksService,
  ],
  exports: [WebhookOutboxHandler, WebhooksService, OutboxService],
})
export class WebhooksModule {}
