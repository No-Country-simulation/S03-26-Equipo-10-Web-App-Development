import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../../common/errors/application.error';
import { CacheService } from '../../../common/services/cache.service';
import { VALID_TRANSITIONS, TestimonialStatus } from '../entities/testimonial.model';
import { TestimonialRepository } from '../repositories/testimonial.repository';

/** Orquesta la regla de estado, la escritura condicional y el outbox transaccional. */
@Injectable()
export class TransitionTestimonialUseCase {
  constructor(
    private readonly repo: TestimonialRepository,
    private readonly cache: CacheService,
  ) {}

  async execute(tenantId: string, testimonialId: string, to: TestimonialStatus, reason?: string) {
    const testimonial = await this.repo.findById(tenantId, testimonialId);
    if (!testimonial) throw new NotFoundError('Testimonial not found');

    if (!VALID_TRANSITIONS[testimonial.status].includes(to)) {
      throw new ConflictError(`Invalid status transition: ${testimonial.status} → ${to}`);
    }

    if (to === 'published') {
      const updated = await this.repo.updateStatus(
        tenantId, testimonialId, testimonial.status, 'published',
        { publishedAt: new Date() },
        {
          eventType: 'testimonial.published',
          payload: result => ({
            id: result.id,
            authorName: result.authorName,
            content: result.content,
            rating: result.rating,
            score: result.score,
            imageUrl: result.imageUrl,
            videoUrl: result.videoUrl,
            videoTitle: result.videoTitle,
            videoThumbnailUrl: result.videoThumbnailUrl,
            publishedAt: result.publishedAt,
            createdAt: result.createdAt,
          }),
        },
      );
      this.cache.invalidateByPrefix(`public:${tenantId}:`);
      return updated;
    }

    if (to === 'rejected') {
      return this.repo.updateStatus(tenantId, testimonialId, testimonial.status, to, {
        moderationNotes: reason || null,
      });
    }

    return this.repo.updateStatus(tenantId, testimonialId, testimonial.status, to);
  }
}
