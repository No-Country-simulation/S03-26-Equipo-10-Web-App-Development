import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../decorators/current-tenant.decorator';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { CreateApiKeyDto, RotateApiKeyDto } from '../../../application/dtos/api-key.dto';
import { ListApiKeysUseCase } from '../../../application/use-cases/list-api-keys.use-case';
import { CreateApiKeyUseCase } from '../../../application/use-cases/create-api-key.use-case';
import { RotateApiKeyUseCase } from '../../../application/use-cases/rotate-api-key.use-case';
import { RevokeApiKeyUseCase } from '../../../application/use-cases/revoke-api-key.use-case';

@Controller('api-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ApiKeysController {
  constructor(
    private readonly listApiKeys: ListApiKeysUseCase,
    private readonly createApiKey: CreateApiKeyUseCase,
    private readonly rotateApiKey: RotateApiKeyUseCase,
    private readonly revokeApiKey: RevokeApiKeyUseCase,
  ) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.listApiKeys.execute(tenantId);
  }

  @Post()
  create(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.createApiKey.execute(tenantId, dto);
  }

  @Post(':api_key_id/rotate')
  rotate(
    @CurrentTenantId() tenantId: string,
    @Param('api_key_id') apiKeyId: string,
    @Body() dto: RotateApiKeyDto,
  ) {
    return this.rotateApiKey.execute(tenantId, apiKeyId, dto);
  }

  @Delete(':api_key_id')
  remove(
    @CurrentTenantId() tenantId: string,
    @Param('api_key_id') apiKeyId: string,
  ) {
    return this.revokeApiKey.execute(tenantId, apiKeyId);
  }
}
