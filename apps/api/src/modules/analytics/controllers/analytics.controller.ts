import { AnalyticsService } from '../services/analytics.service';
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../../../common/decorators/current-tenant.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  dashboard(@CurrentTenantId() tenantId: string) {
    return this.analyticsService.getDashboard(tenantId);
  }

  @Get('testimonials/:testimonial_id')
  testimonialMetrics(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.analyticsService.getTestimonialMetrics(tenantId, testimonialId);
  }
}
