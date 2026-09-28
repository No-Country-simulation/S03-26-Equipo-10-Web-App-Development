import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants';
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

import { CloudModule } from '../shared/cloud';
import { AnalyticsModule } from '../analytics';
import { ScoringService } from './services/scoring.service';

@Module({
  imports: [AnalyticsModule, CloudModule, TenantsModule],
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
