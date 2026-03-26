import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../decorators/current-tenant.decorator';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { UpdateTenantDto } from '../../../application/dtos/update-tenant.dto';
import { GetTenantUseCase } from '../../../application/use-cases/get-tenant.use-case';
import { UpdateTenantUseCase } from '../../../application/use-cases/update-tenant.use-case';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(
    private readonly getTenant: GetTenantUseCase,
    private readonly updateTenant: UpdateTenantUseCase,
  ) {}

  @Get('me')
  getMe(@CurrentTenantId() tenantId: string) {
    return this.getTenant.execute(tenantId);
  }

  @Patch('me')
  @Roles('admin')
  updateMe(
    @CurrentTenantId() tenantId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.updateTenant.execute(tenantId, dto);
  }
}
