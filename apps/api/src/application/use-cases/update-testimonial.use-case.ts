import { Inject, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { TESTIMONIAL_REPOSITORY, ITestimonialRepository } from '../../core/repositories/testimonial.repository';
import { CATEGORY_REPOSITORY, ICategoryRepository } from '../../core/repositories/category.repository';
import { UpdateTestimonialDto } from '../dtos/testimonials.dto';
import { TestimonialMapper } from '../mappers/testimonial.mapper';

@Injectable()
export class UpdateTestimonialUseCase {
  constructor(
    @Inject(TESTIMONIAL_REPOSITORY) private readonly repo: ITestimonialRepository,
    @Inject(CATEGORY_REPOSITORY) private readonly categoryRepo: ICategoryRepository,
    private readonly mapper: TestimonialMapper,
  ) {}

  async execute(tenantId: string, testimonialId: string, dto: UpdateTestimonialDto) {
    const entity = await this.repo.findById(tenantId, testimonialId);
    if (!entity) throw new NotFoundException('Testimonial not found');

    if (dto.categoryId) {
      const category = await this.categoryRepo.findById(tenantId, dto.categoryId);
      if (!category) throw new NotFoundException('Category not found');
    }

    try {
      entity.update({
        authorName: dto.authorName,
        content: dto.content,
        rating: dto.rating,
        categoryId: dto.categoryId,
      });
    } catch {
      throw new ConflictException('Published testimonial cannot be edited');
    }

    await this.repo.save(entity);
    return this.mapper.toFullView(entity);
  }
}
