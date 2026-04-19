import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { TenantsModule } from '../tenants/tenants.module';

import { AnalyticsController } from './controllers/analytics.controller';
import { PublicAnalyticsController } from './controllers/public-analytics.controller';
import { AnalyticsService } from './services/analytics.service';

import { AnalyticsRepository } from './repositories/analytics.repository';
import { TestimonialRepository } from '../testimonials/repositories/testimonial.repository';

@Module({
  imports: [WebhooksModule, TenantsModule],
  controllers: [AnalyticsController, PublicAnalyticsController],
  providers: [
    AnalyticsRepository,
    TestimonialRepository,
    AnalyticsService,
  ],
  exports: [AnalyticsService, AnalyticsRepository],
})
export class AnalyticsModule {}

