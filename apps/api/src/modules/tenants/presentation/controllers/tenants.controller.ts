import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../../../../common/decorators/current-tenant.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { UpdateTenantDto } from '../../application/dto/update-tenant.dto';
import { TenantsService } from '../../application/services/tenants.service';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('me')
  getMe(@CurrentTenantId() tenantId: string) {
    return this.tenantsService.getMe(tenantId);
  }

  @Patch('me')
  @Roles('admin')
  updateMe(
    @CurrentTenantId() tenantId: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.updateMe(tenantId, dto);
  }
}
