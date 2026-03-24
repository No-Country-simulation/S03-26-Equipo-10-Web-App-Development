import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../../../../common/decorators/current-tenant.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { CreateApiKeyDto, RotateApiKeyDto } from '../../application/dto/api-key.dto';
import { ApiKeysService } from '../../application/services/api-keys.service';

@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.apiKeysService.list(tenantId);
  }

  @Post()
  create(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeysService.create(tenantId, dto);
  }

  @Post(':api_key_id/rotate')
  rotate(
    @CurrentTenantId() tenantId: string,
    @Param('api_key_id') apiKeyId: string,
    @Body() dto: RotateApiKeyDto,
  ) {
    return this.apiKeysService.rotate(tenantId, apiKeyId, dto);
  }

  @Delete(':api_key_id')
  remove(
    @CurrentTenantId() tenantId: string,
    @Param('api_key_id') apiKeyId: string,
  ) {
    return this.apiKeysService.revoke(tenantId, apiKeyId);
  }
}
