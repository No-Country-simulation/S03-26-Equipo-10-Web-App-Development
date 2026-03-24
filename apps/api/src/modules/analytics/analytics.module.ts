import { Module } from '@nestjs/common';
import { AnalyticsService } from './application/services/analytics.service';
import { AnalyticsController } from './presentation/controllers/analytics.controller';
import { PublicAnalyticsController } from './presentation/controllers/public-analytics.controller';

@Module({
  controllers: [AnalyticsController, PublicAnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
