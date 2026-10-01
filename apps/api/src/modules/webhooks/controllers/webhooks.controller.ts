import { WebhooksService } from '../services/webhooks.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentTenantId } from '../../../common/decorators/current-tenant.decorator';
import { Idempotent } from '../../../common/decorators/idempotent.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CreateWebhookDto, UpdateWebhookDto } from '../dto/webhook.dto';

@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.webhooksService.listWebhooks(tenantId);
  }

  @Get(':webhook_id')
  getOne(
    @CurrentTenantId() tenantId: string,
    @Param('webhook_id') webhookId: string,
  ) {
    return this.webhooksService.getWebhook(tenantId, webhookId);
  }

  @Post()
  create(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooksService.createWebhook(tenantId, dto);
  }

  @Patch(':webhook_id')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('webhook_id') webhookId: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.updateWebhook(tenantId, webhookId, dto);
  }

  @Delete(':webhook_id')
  remove(
    @CurrentTenantId() tenantId: string,
    @Param('webhook_id') webhookId: string,
  ) {
    return this.webhooksService.deleteWebhook(tenantId, webhookId);
  }

  @Get(':webhook_id/deliveries')
  deliveries(
    @CurrentTenantId() tenantId: string,
    @Param('webhook_id') webhookId: string,
  ) {
    return this.webhooksService.listWebhookDeliveries(tenantId, webhookId);
  }

  @Post(':webhook_id/test')
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  test(
    @CurrentTenantId() tenantId: string,
    @Param('webhook_id') webhookId: string,
  ) {
    return this.webhooksService.testWebhook(tenantId, webhookId);
  }

  @Post(':webhook_id/deliveries/:delivery_id/replay')
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  replay(
    @CurrentTenantId() tenantId: string,
    @Param('webhook_id', ParseUUIDPipe) webhookId: string,
    @Param('delivery_id', ParseUUIDPipe) deliveryId: string,
  ) {
    return this.webhooksService.replayDead(tenantId, webhookId, deliveryId);
  }
}
