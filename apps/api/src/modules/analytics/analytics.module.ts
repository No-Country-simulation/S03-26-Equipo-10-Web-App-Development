import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';

import { AnalyticsController } from './controllers/analytics.controller';
import { PublicAnalyticsController } from './controllers/public-analytics.controller';
import { AnalyticsService } from './services/analytics.service';

import { AnalyticsRepository } from './repositories/analytics.repository';

@Module({
  imports: [WebhooksModule],
  controllers: [AnalyticsController, PublicAnalyticsController],
  providers: [
    AnalyticsRepository,
    AnalyticsService,
  ],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}


