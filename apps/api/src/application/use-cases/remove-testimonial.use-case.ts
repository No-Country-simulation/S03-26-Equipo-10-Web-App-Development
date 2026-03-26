import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TESTIMONIAL_REPOSITORY, ITestimonialRepository } from '../../core/repositories/testimonial.repository';

@Injectable()
export class RemoveTestimonialUseCase {
  constructor(
    @Inject(TESTIMONIAL_REPOSITORY) private readonly repo: ITestimonialRepository,
  ) {}

  async execute(tenantId: string, testimonialId: string) {
    const entity = await this.repo.findById(tenantId, testimonialId);
    if (!entity) throw new NotFoundException('Testimonial not found');

    await this.repo.remove(tenantId, testimonialId);
    return { id: testimonialId, deleted: true };
  }
}
