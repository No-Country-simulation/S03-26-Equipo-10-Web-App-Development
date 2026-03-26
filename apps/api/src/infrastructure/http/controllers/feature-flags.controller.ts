import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../decorators/current-tenant.decorator';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { UpdateFeatureFlagDto } from '../../../application/dtos/update-feature-flag.dto';
import { ListFeatureFlagsUseCase } from '../../../application/use-cases/list-feature-flags.use-case';
import { SetFeatureFlagUseCase } from '../../../application/use-cases/set-feature-flag.use-case';

@Controller('feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class FeatureFlagsController {
  constructor(
    private readonly listFeatureFlags: ListFeatureFlagsUseCase,
    private readonly setFeatureFlag: SetFeatureFlagUseCase,
  ) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.listFeatureFlags.execute(tenantId);
  }

  @Patch(':flag_name')
  set(
    @CurrentTenantId() tenantId: string,
    @Param('flag_name') flagName: string,
    @Body() dto: UpdateFeatureFlagDto,
  ) {
    return this.setFeatureFlag.execute(tenantId, flagName, dto.enabled);
  }
}
