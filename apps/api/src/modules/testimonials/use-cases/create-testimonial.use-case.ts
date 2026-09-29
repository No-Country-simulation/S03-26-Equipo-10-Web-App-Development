import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../../common/errors/application.error';
import { CategoryRepository } from '../repositories/category.repository';
import { TestimonialRepository } from '../repositories/testimonial.repository';

export interface CreateTestimonialInput {
  authorName: string;
  content: string;
  rating: number;
  categoryId?: string | undefined;
  tagIds?: string[] | undefined;
}

/** Valida las reglas de creación y delega la escritura atómica con el outbox. */
@Injectable()
export class CreateTestimonialUseCase {
  constructor(
    private readonly repo: TestimonialRepository,
    private readonly categories: CategoryRepository,
  ) {}

  async execute(tenantId: string, creatorUserId: string, input: CreateTestimonialInput) {
    if (input.rating < 1 || input.rating > 5) {
      throw new ConflictError('Rating must be between 1 and 5');
    }

    if (input.categoryId) {
      const category = await this.categories.findById(tenantId, input.categoryId);
      if (!category) throw new NotFoundError('Category not found');
    }

    return this.repo.createWithEvent({
      tenantId,
      createdById: creatorUserId,
      authorName: input.authorName,
      content: input.content,
      rating: input.rating,
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.tagIds !== undefined && { tagIds: input.tagIds }),
    }, 'draft', {
      eventType: 'testimonial.created',
      payload: testimonial => ({
        id: testimonial.id,
        authorName: testimonial.authorName,
        content: testimonial.content,
        rating: testimonial.rating,
        status: testimonial.status,
        imageUrl: testimonial.imageUrl,
        videoUrl: testimonial.videoUrl,
        createdAt: testimonial.createdAt,
      }),
    });
  }
}
