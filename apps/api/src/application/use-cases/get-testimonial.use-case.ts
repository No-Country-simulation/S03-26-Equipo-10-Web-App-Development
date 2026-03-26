import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TESTIMONIAL_REPOSITORY, ITestimonialRepository } from '../../core/repositories/testimonial.repository';
import { TestimonialMapper } from '../mappers/testimonial.mapper';

@Injectable()
export class GetTestimonialUseCase {
  constructor(
    @Inject(TESTIMONIAL_REPOSITORY) private readonly repo: ITestimonialRepository,
    private readonly mapper: TestimonialMapper,
  ) {}

  async execute(tenantId: string, testimonialId: string) {
    const entity = await this.repo.findById(tenantId, testimonialId);
    if (!entity) throw new NotFoundException('Testimonial not found');
    return this.mapper.toFullView(entity);
  }
}
