import { Module } from '@nestjs/common';
import { ANALYTICS_REPOSITORY } from '../../../core/repositories/analytics-event.repository';
import { PrismaAnalyticsRepository } from '../../database/repositories/prisma-analytics-event.repository';
import { GetDashboardUseCase } from '../../../application/use-cases/get-dashboard.use-case';
import { TrackEventUseCase } from '../../../application/use-cases/track-event.use-case';
import { GetTestimonialMetricsUseCase } from '../../../application/use-cases/get-testimonial-metrics.use-case';
import { AnalyticsController } from '../controllers/analytics.controller';
import { PublicAnalyticsController } from '../controllers/public-analytics.controller';

@Module({
  controllers: [AnalyticsController, PublicAnalyticsController],
  providers: [
    { provide: ANALYTICS_REPOSITORY, useClass: PrismaAnalyticsRepository },
    GetDashboardUseCase,
    TrackEventUseCase,
    GetTestimonialMetricsUseCase,
  ],
  exports: [TrackEventUseCase],
})
export class AnalyticsModule {}
