import { Module } from '@nestjs/common';
import { OutboxService } from '../../database/services/outbox.service';

// Domain tokens
import { TESTIMONIAL_REPOSITORY } from '../../../core/repositories/testimonial.repository';
import { TAG_REPOSITORY } from '../../../core/repositories/tag.repository';
import { CATEGORY_REPOSITORY } from '../../../core/repositories/category.repository';

// Application ports
import { OUTBOX_PORT } from '../../../application/ports/outbox.port';

// Infrastructure adapters
import { PrismaTestimonialRepository } from '../../database/repositories/prisma-testimonial.repository';
import { PrismaTagRepository } from '../../database/repositories/prisma-tag.repository';
import { PrismaCategoryRepository } from '../../database/repositories/prisma-category.repository';
import { OutboxAdapter } from '../../external-services/adapters/outbox.adapter';

// Application — Use cases
import { CreateTestimonialUseCase } from '../../../application/use-cases/create-testimonial.use-case';
import { UpdateTestimonialUseCase } from '../../../application/use-cases/update-testimonial.use-case';
import { GetTestimonialUseCase } from '../../../application/use-cases/get-testimonial.use-case';
import { ListTestimonialsUseCase } from '../../../application/use-cases/list-testimonials.use-case';
import { RemoveTestimonialUseCase } from '../../../application/use-cases/remove-testimonial.use-case';
import { SubmitTestimonialUseCase } from '../../../application/use-cases/submit-testimonial.use-case';
import { ApproveTestimonialUseCase } from '../../../application/use-cases/approve-testimonial.use-case';
import { RejectTestimonialUseCase } from '../../../application/use-cases/reject-testimonial.use-case';
import { PublishTestimonialUseCase } from '../../../application/use-cases/publish-testimonial.use-case';
import { ListPublicTestimonialsUseCase } from '../../../application/use-cases/list-public-testimonials.use-case';
import { GetPublicTestimonialUseCase } from '../../../application/use-cases/get-public-testimonial.use-case';

// Application — Services
import { TagsService } from '../../../application/services/tags.service';
import { CategoriesService } from '../../../application/services/categories.service';
import { TestimonialMapper } from '../../../application/mappers/testimonial.mapper';

// Presentation
import { TestimonialsController } from '../controllers/testimonials.controller';
import { TagsController } from '../controllers/tags.controller';
import { CategoriesController } from '../controllers/categories.controller';
import { PublicTestimonialsController } from '../controllers/public-testimonials.controller';

@Module({
  controllers: [
    TestimonialsController,
    TagsController,
    CategoriesController,
    PublicTestimonialsController,
  ],
  providers: [
    // Infrastructure bindings (interface → implementation)
    { provide: TESTIMONIAL_REPOSITORY, useClass: PrismaTestimonialRepository },
    { provide: TAG_REPOSITORY, useClass: PrismaTagRepository },
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
    { provide: OUTBOX_PORT, useClass: OutboxAdapter },
    OutboxService,

    // Application — Use cases
    CreateTestimonialUseCase,
    UpdateTestimonialUseCase,
    GetTestimonialUseCase,
    ListTestimonialsUseCase,
    RemoveTestimonialUseCase,
    SubmitTestimonialUseCase,
    ApproveTestimonialUseCase,
    RejectTestimonialUseCase,
    PublishTestimonialUseCase,
    ListPublicTestimonialsUseCase,
    GetPublicTestimonialUseCase,

    // Application — Services
    TagsService,
    CategoriesService,
    TestimonialMapper,
  ],
  exports: [
    ListTestimonialsUseCase,
    GetTestimonialUseCase,
  ],
})
export class TestimonialsModule {}
