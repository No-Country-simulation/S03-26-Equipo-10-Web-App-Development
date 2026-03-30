import { Module } from '@nestjs/common';
import { OutboxService } from '../webhooks/services/outbox.service';

import { TESTIMONIAL_REPOSITORY } from './repositories/testimonial.repository';
import { TAG_REPOSITORY } from './repositories/tag.repository';
import { CATEGORY_REPOSITORY } from './repositories/category.repository';
import { OUTBOX_PORT } from '../webhooks/interfaces/outbox.port';

import { PrismaTestimonialRepository } from './repositories/prisma-testimonial.repository';
import { PrismaTagRepository } from './repositories/prisma-tag.repository';
import { PrismaCategoryRepository } from './repositories/prisma-category.repository';
import { OutboxAdapter } from '../webhooks/services/outbox.adapter';

import { TestimonialsService } from './services/testimonials.service';
import { TagsService } from './services/tags.service';
import { CategoriesService } from './services/categories.service';
import { TestimonialMapper } from './mappers/testimonial.mapper';

import { TestimonialsController } from './controllers/testimonials.controller';
import { TagsController } from './controllers/tags.controller';
import { CategoriesController } from './controllers/categories.controller';
import { PublicTestimonialsController } from './controllers/public-testimonials.controller';

@Module({
  controllers: [
    TestimonialsController,
    TagsController,
    CategoriesController,
    PublicTestimonialsController,
  ],
  providers: [
    { provide: TESTIMONIAL_REPOSITORY, useClass: PrismaTestimonialRepository },
    { provide: TAG_REPOSITORY, useClass: PrismaTagRepository },
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
    { provide: OUTBOX_PORT, useClass: OutboxAdapter },
    OutboxService,
    TestimonialsService,
    TagsService,
    CategoriesService,
    TestimonialMapper,
  ],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
