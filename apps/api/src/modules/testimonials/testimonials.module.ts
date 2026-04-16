import { Module, forwardRef } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { TenantsModule } from '../tenants/tenants.module';
import { CategoryRepository } from './repositories/category.repository';
import { TestimonialRepository } from './repositories/testimonial.repository';
import { TagRepository } from './repositories/tag.repository';

import { TestimonialsService } from './services/testimonials.service';
import { TagsService } from './services/tags.service';
import { CategoriesService } from './services/categories.service';

import { TestimonialsController } from './controllers/testimonials.controller';
import { TagsController } from './controllers/tags.controller';
import { CategoriesController } from './controllers/categories.controller';
import { PublicTestimonialsController } from './controllers/public-testimonials.controller';

import { CloudModule } from '../shared/cloud/cloud.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { ScoringService } from './services/scoring.service';

@Module({
  imports: [AnalyticsModule, FeatureFlagsModule, WebhooksModule, CloudModule, TenantsModule],
  controllers: [
    TestimonialsController,
    TagsController,
    CategoriesController,
    PublicTestimonialsController,
  ],
  providers: [
    TestimonialRepository,
    TagRepository,
    CategoryRepository,
    TestimonialsService,
    TagsService,
    CategoriesService,
    ScoringService,
  ],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
