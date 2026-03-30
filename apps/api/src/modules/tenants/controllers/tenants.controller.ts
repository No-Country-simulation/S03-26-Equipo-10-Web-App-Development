import { TenantsService } from '../services/tenants.service';
import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../../../common/decorators/current-tenant.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UpdateTenantDto } from '../dto/update-tenant.dto';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  getMe(@CurrentTenantId() tenantId: string) {
    return this.tenantsService.getTenant(tenantId);
  }

  @Patch('me')
  @Roles('admin')
  updateMe(
    @CurrentTenantId() tenantId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.updateTenant(tenantId, dto);
  }
}
