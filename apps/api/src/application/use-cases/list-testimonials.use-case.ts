import { Inject, Injectable } from '@nestjs/common';
import { TESTIMONIAL_REPOSITORY, ITestimonialRepository } from '../../core/repositories/testimonial.repository';
import { TestimonialMapper } from '../mappers/testimonial.mapper';

@Injectable()
export class ListTestimonialsUseCase {
  constructor(
    @Inject(TESTIMONIAL_REPOSITORY) private readonly repo: ITestimonialRepository,
    private readonly mapper: TestimonialMapper,
  ) {}

  async execute(tenantId: string) {
    const entities = await this.repo.findByTenant(tenantId);

    return {
      items: await Promise.all(entities.map(e => this.mapper.toFullView(e))),
      meta: {
        total: entities.length,
        page: 1,
        limit: entities.length,
      },
    };
  }
}
