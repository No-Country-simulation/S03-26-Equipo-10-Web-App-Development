import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Testimonial } from '../../core/entities/testimonial.entity';
import { TESTIMONIAL_REPOSITORY, ITestimonialRepository } from '../../core/repositories/testimonial.repository';
import { CATEGORY_REPOSITORY, ICategoryRepository } from '../../core/repositories/category.repository';
import { OUTBOX_PORT, IOutboxPort } from '../ports/outbox.port';
import { CreateTestimonialDto } from '../dtos/testimonials.dto';
import { TestimonialMapper } from '../mappers/testimonial.mapper';

@Injectable()
export class CreateTestimonialUseCase {
  constructor(
    @Inject(TESTIMONIAL_REPOSITORY) private readonly repo: ITestimonialRepository,
    @Inject(CATEGORY_REPOSITORY) private readonly categoryRepo: ICategoryRepository,
    @Inject(OUTBOX_PORT) private readonly outbox: IOutboxPort,
    private readonly mapper: TestimonialMapper,
  ) {}

  async execute(tenantId: string, creatorUserId: string, dto: CreateTestimonialDto) {
    if (dto.categoryId) {
      const category = await this.categoryRepo.findById(tenantId, dto.categoryId);
      if (!category) {
        throw new Error('Category not found');
      }
    }

    const entity = Testimonial.create({
      id: randomUUID(),
      tenantId,
      createdById: creatorUserId,
      authorName: dto.authorName,
      content: dto.content,
      rating: dto.rating,
      categoryId: dto.categoryId,
    });

    await this.repo.save(entity);

    await this.outbox.emit({
      tenantId,
      eventType: 'testimonial.created',
      payload: { testimonialId: entity.id, authorName: entity.authorName },
    });

    return this.mapper.toFullView(entity);
  }
}
