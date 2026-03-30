import { Module } from '@nestjs/common';

import { AnalyticsController } from './controllers/analytics.controller';
import { PublicAnalyticsController } from './controllers/public-analytics.controller';
import { AnalyticsService } from './services/analytics.service';

import { ANALYTICS_REPOSITORY } from './repositories/analytics-event.repository';
import { PrismaAnalyticsRepository } from './repositories/prisma-analytics-event.repository';

@Module({
  controllers: [AnalyticsController, PublicAnalyticsController],
  providers: [
    { provide: ANALYTICS_REPOSITORY, useClass: PrismaAnalyticsRepository },
    AnalyticsService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
