import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../../../../common/decorators/current-tenant.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { UpdateFeatureFlagDto } from '../../application/dto/update-feature-flag.dto';
import { FeatureFlagsService } from '../../application/services/feature-flags.service';

@Controller('feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.featureFlagsService.list(tenantId);
  }

  @Patch(':flag_name')
  set(
    @CurrentTenantId() tenantId: string,
    @Param('flag_name') flagName: string,
    @Body() dto: UpdateFeatureFlagDto,
  ) {
    return this.featureFlagsService.set(tenantId, flagName, dto.enabled);
  }
}
