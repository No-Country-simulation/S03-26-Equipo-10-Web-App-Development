import { Inject, Injectable } from '@nestjs/common';
import { TESTIMONIAL_REPOSITORY, ITestimonialRepository } from '../../core/repositories/testimonial.repository';
import { PublicTestimonialsQueryDto } from '../dtos/testimonials.dto';
import { TestimonialMapper } from '../mappers/testimonial.mapper';

@Injectable()
export class ListPublicTestimonialsUseCase {
  constructor(
    @Inject(TESTIMONIAL_REPOSITORY) private readonly repo: ITestimonialRepository,
    private readonly mapper: TestimonialMapper,
  ) {}

  async execute(tenantId: string, query: PublicTestimonialsQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

    const result = await this.repo.findPublished(tenantId, {
      q: query.q,
      tag: query.tag,
      category: query.category,
      sort: query.sort,
      page,
      limit,
    });

    return {
      items: await Promise.all(result.items.map(e => this.mapper.toFullView(e))),
      meta: {
        total: result.total,
        page,
        limit,
      },
    };
  }
}
