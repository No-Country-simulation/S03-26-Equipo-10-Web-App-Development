import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { TESTIMONIAL_REPOSITORY, ITestimonialRepository } from '../../core/repositories/testimonial.repository';
import { OUTBOX_PORT, IOutboxPort } from '../ports/outbox.port';
import { TestimonialMapper } from '../mappers/testimonial.mapper';

@Injectable()
export class PublishTestimonialUseCase {
  constructor(
    @Inject(TESTIMONIAL_REPOSITORY) private readonly repo: ITestimonialRepository,
    @Inject(OUTBOX_PORT) private readonly outbox: IOutboxPort,
    private readonly mapper: TestimonialMapper,
  ) {}

  async execute(tenantId: string, testimonialId: string) {
    const entity = await this.repo.findById(tenantId, testimonialId);
    if (!entity) throw new NotFoundException('Testimonial not found');

    try {
      entity.publish();
    } catch {
      throw new ConflictException('Invalid status transition');
    }

    await this.repo.save(entity);

    await this.outbox.emit({
      tenantId,
      eventType: 'testimonial.published',
      payload: {
        testimonialId: entity.id,
        authorName: entity.authorName,
        score: entity.score,
      },
    });

    return this.mapper.toFullView(entity);
  }
}
