import {
  CanActivate,
  Controller,
  Get,
  Injectable,
  Query,
  UseGuards,
} from '@nestjs/common';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { CurrentTenantId } from '../../../common/decorators/current-tenant.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { UnavailableError } from '../../../common/errors/application.error';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { StatisticsReadService } from '../services/statistics-read.service';
export class StatisticsQueryDto extends createZodDto(z.object({}).strict()) {}
@Injectable()
export class BiStatisticsGuard implements CanActivate {
  private readonly bi = process.env.BI_ENABLED === 'true';
  private readonly enabled = process.env.BI_STATISTICS_ENABLED === 'true';
  canActivate(): boolean {
    if (!this.bi)
      throw new UnavailableError(
        'Business intelligence is disabled',
        'BI_DISABLED',
      );
    if (!this.enabled)
      throw new UnavailableError(
        'Statistical analytics is disabled',
        'BI_STATISTICS_DISABLED',
      );
    return true;
  }
}
@Controller('bi')
@UseGuards(JwtAuthGuard, RolesGuard, BiStatisticsGuard, RateLimitGuard)
@Roles('admin', 'editor')
@RateLimit({ limit: 120, windowSeconds: 60 })
export class BiStatisticsController {
  constructor(private readonly statistics: StatisticsReadService) {}
  @Get('statistics')
  get(
    @CurrentTenantId() tenantId: string,
    @Query() _query: StatisticsQueryDto,
  ) {
    return this.statistics.get(tenantId);
  }
}
