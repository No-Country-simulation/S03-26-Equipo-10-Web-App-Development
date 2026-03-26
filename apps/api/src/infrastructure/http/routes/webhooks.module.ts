import { Module } from '@nestjs/common';
import { WEBHOOK_REPOSITORY } from '../../../core/repositories/webhook.repository';
import { PrismaWebhookRepository } from '../../database/repositories/prisma-webhook.repository';
import { WEBHOOK_DISPATCHER } from '../../../application/ports/webhook-dispatcher.port';
import { HttpWebhookDispatcher } from '../../external-services/dispatch/http-webhook-dispatcher';
import { ListWebhooksUseCase } from '../../../application/use-cases/list-webhooks.use-case';
import { CreateWebhookUseCase } from '../../../application/use-cases/create-webhook.use-case';
import { UpdateWebhookUseCase } from '../../../application/use-cases/update-webhook.use-case';
import { DeleteWebhookUseCase } from '../../../application/use-cases/delete-webhook.use-case';
import { ListWebhookDeliveriesUseCase } from '../../../application/use-cases/list-webhook-deliveries.use-case';
import { TestWebhookUseCase } from '../../../application/use-cases/test-webhook.use-case';
import { DispatchOutboxEventUseCase } from '../../../application/use-cases/dispatch-outbox-event.use-case';
import { WebhooksController } from '../controllers/webhooks.controller';
import { WebhookOutboxHandler, WebhooksBootstrapService } from '../../../application/services/webhook-outbox-handler.service';
import { HttpResilienceService } from '../../external-services/http-resilience/http-resilience.service';
import { LoggerService } from '../../external-services/logging/logger.service';
import { OutboxProcessor } from '../../database/services/outbox.processor';
import { OutboxService } from '../../database/services/outbox.service';
import { PrismaModule } from '../../database/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WebhooksController],
  providers: [
    { provide: WEBHOOK_REPOSITORY, useClass: PrismaWebhookRepository },
    { provide: WEBHOOK_DISPATCHER, useClass: HttpWebhookDispatcher },
    HttpResilienceService,
    LoggerService,
    OutboxProcessor,
    OutboxService,
    ListWebhooksUseCase,
    CreateWebhookUseCase,
    UpdateWebhookUseCase,
    DeleteWebhookUseCase,
    ListWebhookDeliveriesUseCase,
    TestWebhookUseCase,
    DispatchOutboxEventUseCase,
    WebhookOutboxHandler,
    WebhooksBootstrapService,
  ],
  exports: [WebhookOutboxHandler],
})
export class WebhooksModule {}
