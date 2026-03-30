import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';

import { CategoryRepository } from './repositories/category.repository';
import { TestimonialRepository } from './repositories/testimonial.repository';
import { TagRepository } from './repositories/tag.repository';

import { TestimonialsService } from './services/testimonials.service';
import { TagsService } from './services/tags.service';
import { CategoriesService } from './services/categories.service';
import { TestimonialMapper } from './mappers/testimonial.mapper';

import { TestimonialsController } from './controllers/testimonials.controller';
import { TagsController } from './controllers/tags.controller';
import { CategoriesController } from './controllers/categories.controller';
import { PublicTestimonialsController } from './controllers/public-testimonials.controller';

@Module({
  imports: [WebhooksModule],
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
    TestimonialMapper,
  ],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}


