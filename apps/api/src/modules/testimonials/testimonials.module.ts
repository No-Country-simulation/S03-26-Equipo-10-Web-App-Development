import { Module } from '@nestjs/common';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { TestimonialsService } from './application/services/testimonials.service';
import { CategoriesController } from './presentation/controllers/categories.controller';
import { PublicTestimonialsController } from './presentation/controllers/public-testimonials.controller';
import { TagsController } from './presentation/controllers/tags.controller';
import { TestimonialsController } from './presentation/controllers/testimonials.controller';

@Module({
  controllers: [
    TestimonialsController,
    TagsController,
    CategoriesController,
    PublicTestimonialsController,
  ],
  providers: [TestimonialsService, OutboxService],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
