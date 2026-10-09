import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../../../common/decorators/current-tenant.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { DashboardQueryDto } from '../dtos/dashboard-query.dto';
import { DashboardService } from '../services/dashboard.service';

@Controller('bi')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor')
export class BiController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get('dashboard')
  @Header('Cache-Control', 'private, no-store')
  getDashboard(@CurrentTenantId() tenantId: string, @Query() query: DashboardQueryDto) {
    return this.dashboard.get(tenantId, query);
  }
}
