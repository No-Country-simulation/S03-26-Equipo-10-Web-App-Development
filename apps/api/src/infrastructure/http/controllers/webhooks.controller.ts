import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentTenantId } from '../decorators/current-tenant.decorator';
import { Idempotent } from '../decorators/idempotent.decorator';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { CreateWebhookDto, UpdateWebhookDto } from '../../../application/dtos/webhook.dto';
import { ListWebhooksUseCase } from '../../../application/use-cases/list-webhooks.use-case';
import { CreateWebhookUseCase } from '../../../application/use-cases/create-webhook.use-case';
import { UpdateWebhookUseCase } from '../../../application/use-cases/update-webhook.use-case';
import { DeleteWebhookUseCase } from '../../../application/use-cases/delete-webhook.use-case';
import { ListWebhookDeliveriesUseCase } from '../../../application/use-cases/list-webhook-deliveries.use-case';
import { TestWebhookUseCase } from '../../../application/use-cases/test-webhook.use-case';

@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class WebhooksController {
  constructor(
    private readonly listWebhooks: ListWebhooksUseCase,
    private readonly createWebhook: CreateWebhookUseCase,
    private readonly updateWebhook: UpdateWebhookUseCase,
    private readonly deleteWebhook: DeleteWebhookUseCase,
    private readonly listWebhookDeliveries: ListWebhookDeliveriesUseCase,
    private readonly testWebhook: TestWebhookUseCase,
  ) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.listWebhooks.execute(tenantId);
  }

  @Post()
  create(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.createWebhook.execute(tenantId, dto);
  }

  @Patch(':webhook_id')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('webhook_id') webhookId: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.updateWebhook.execute(tenantId, webhookId, dto);
  }

  @Delete(':webhook_id')
  remove(
    @CurrentTenantId() tenantId: string,
    @Param('webhook_id') webhookId: string,
  ) {
    return this.deleteWebhook.execute(tenantId, webhookId);
  }

  @Get(':webhook_id/deliveries')
  deliveries(
    @CurrentTenantId() tenantId: string,
    @Param('webhook_id') webhookId: string,
  ) {
    return this.listWebhookDeliveries.execute(tenantId, webhookId);
  }

  @Post(':webhook_id/test')
  @Idempotent()
  test(
    @CurrentTenantId() tenantId: string,
    @Param('webhook_id') webhookId: string,
  ) {
    return this.testWebhook.execute(tenantId, webhookId);
  }
}
