import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../decorators/current-tenant.decorator';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { GetDashboardUseCase } from '../../../application/use-cases/get-dashboard.use-case';
import { GetTestimonialMetricsUseCase } from '../../../application/use-cases/get-testimonial-metrics.use-case';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor')
export class AnalyticsController {
  constructor(
    private readonly getDashboard: GetDashboardUseCase,
    private readonly getTestimonialMetrics: GetTestimonialMetricsUseCase,
  ) {}

  @Get('dashboard')
  dashboard(@CurrentTenantId() tenantId: string) {
    return this.getDashboard.execute(tenantId);
  }

  @Get('testimonials/:testimonial_id')
  testimonialMetrics(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.getTestimonialMetrics.execute(tenantId, testimonialId);
  }
}
