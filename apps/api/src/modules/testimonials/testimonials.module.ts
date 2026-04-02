import { Module } from '@nestjs/common';
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

import { CloudinaryService } from '../shared/cloud/cloudinary.service';
import { YoutubeService } from '../shared/cloud/youtube.service';
import { AnalyticsModule } from '../analytics/analytics.module';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { ScoringService } from './services/scoring.service';

@Module({
  imports: [AnalyticsModule, FeatureFlagsModule],
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
    CloudinaryService,
    YoutubeService,
  ],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
