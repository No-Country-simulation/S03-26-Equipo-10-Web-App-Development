import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { TESTIMONIAL_REPOSITORY, ITestimonialRepository } from '../../core/repositories/testimonial.repository';
import { TestimonialMapper } from '../mappers/testimonial.mapper';

@Injectable()
export class SubmitTestimonialUseCase {
  constructor(
    @Inject(TESTIMONIAL_REPOSITORY) private readonly repo: ITestimonialRepository,
    private readonly mapper: TestimonialMapper,
  ) {}

  async execute(tenantId: string, testimonialId: string) {
    const entity = await this.repo.findById(tenantId, testimonialId);
    if (!entity) throw new NotFoundException('Testimonial not found');

    try {
      entity.submit();
    } catch {
      throw new ConflictException('Invalid status transition');
    }

    await this.repo.save(entity);
    return this.mapper.toFullView(entity);
  }
}
