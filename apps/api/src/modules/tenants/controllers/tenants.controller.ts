import { TenantsService } from '../services/tenants.service';
import { Body, Controller, Delete, Get, Patch, Put, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../../../common/decorators/current-tenant.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UpdateTenantDto } from '../dto/update-tenant.dto';
import { UploadTenantLogoDto } from '../dto/upload-tenant-logo.dto';
import { TenantLogoService } from '../services/tenant-logo.service';

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService, private readonly logos: TenantLogoService) { }

  @Get('me')
  getMe(@CurrentTenantId() tenantId: string) {
    return this.tenantsService.getTenant(tenantId);
  }

  @Put('me/logo')
  @Roles('admin')
  uploadLogo(@CurrentTenantId() tenantId: string, @Body() dto: UploadTenantLogoDto) {
    return this.logos.upload(tenantId, dto.imageBase64);
  }

  @Delete('me/logo')
  @Roles('admin')
  removeLogo(@CurrentTenantId() tenantId: string) {
    return this.logos.remove(tenantId);
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
