import { WebhooksService } from '../services/webhooks.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CurrentTenantId } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { ApiRequest, AuthenticatedUser } from '../../../common/interfaces/auth-context.interface';
import { IdempotencyService } from '../../../common/services/idempotency.service';
import { Idempotent } from '../../../common/decorators/idempotent.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CreateWebhookDto, UpdateWebhookDto } from '../dto/webhook.dto';
import { parseAdminPage } from '../../../common/pagination/admin-page';

@Controller('webhooks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Get()
  list(@CurrentTenantId() tenantId: string, @Query() query: Record<string, unknown>) {
    return this.webhooksService.listWebhooks(tenantId, parseAdminPage(query));
  }

  @Get(':webhook_id')
  getOne(
    @CurrentTenantId() tenantId: string,
    @Param('webhook_id') webhookId: string,
  ) {
    return this.webhooksService.getWebhook(tenantId, webhookId);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.webhooksService.createWebhook(tenantId, dto);
  }

  @Post(':webhook_id/rotate-secret')
  @Header('Cache-Control', 'no-store')
  rotateSecret(
    @CurrentTenantId() tenantId: string,
    @Param('webhook_id', ParseUUIDPipe) webhookId: string,
  ) {
    return this.webhooksService.rotateSecret(tenantId, webhookId);
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
    @Query() query: Record<string, unknown>,
  ) {
    return this.webhooksService.listWebhookDeliveries(tenantId, webhookId, parseAdminPage(query));
  }

  @Post(':webhook_id/test')
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  @Header('Cache-Control', 'no-store')
  async test(
    @CurrentTenantId() tenantId: string,
    @Param('webhook_id') webhookId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: ApiRequest,
  ) {
    const result = await this.idempotency.execute({
      key, tenantId, principalKind: 'user', principalId: user.userId,
      method: 'POST', path: req.path, payload: { webhookId }, statusCode: 202,
    }, tx => this.webhooksService.testWebhook(tenantId, webhookId, tx));
    return result.value;
  }

  @Post(':webhook_id/deliveries/:delivery_id/replay')
  @HttpCode(HttpStatus.ACCEPTED)
  @Idempotent()
  @Header('Cache-Control', 'no-store')
  async replay(
    @CurrentTenantId() tenantId: string,
    @Param('webhook_id', ParseUUIDPipe) webhookId: string,
    @Param('delivery_id', ParseUUIDPipe) deliveryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: ApiRequest,
  ) {
    const result = await this.idempotency.execute({
      key, tenantId, principalKind: 'user', principalId: user.userId,
      method: 'POST', path: req.path, payload: { webhookId, deliveryId }, statusCode: 202,
    }, tx => this.webhooksService.replayDead(tenantId, webhookId, deliveryId, tx));
    return result.value;
  }
}
