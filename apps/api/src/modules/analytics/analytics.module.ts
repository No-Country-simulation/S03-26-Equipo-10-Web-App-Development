import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants';

import { AnalyticsController } from './controllers/analytics.controller';
import { PublicAnalyticsController } from './controllers/public-analytics.controller';
import { AnalyticsService } from './services/analytics.service';

import { AnalyticsRepository } from './repositories/analytics.repository';

@Module({
  imports: [TenantsModule],
  controllers: [AnalyticsController, PublicAnalyticsController],
  providers: [
    AnalyticsRepository,
    AnalyticsService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
