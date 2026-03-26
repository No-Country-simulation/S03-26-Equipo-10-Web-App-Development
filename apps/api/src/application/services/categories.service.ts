import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CATEGORY_REPOSITORY, ICategoryRepository } from '../../core/repositories/category.repository';
import { CreateCategoryDto, UpdateCategoryDto } from '../dtos/testimonials.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(CATEGORY_REPOSITORY) private readonly categoryRepo: ICategoryRepository,
  ) {}

  async list(tenantId: string) {
    const categories = await this.categoryRepo.findByTenant(tenantId);
    return {
      items: categories,
      meta: { total: categories.length, page: 1, limit: categories.length },
    };
  }

  async create(tenantId: string, dto: CreateCategoryDto) {
    return this.categoryRepo.create(tenantId, dto.name);
  }

  async update(tenantId: string, categoryId: string, dto: UpdateCategoryDto) {
    const category = await this.categoryRepo.findById(tenantId, categoryId);
    if (!category) throw new NotFoundException('Category not found');
    return this.categoryRepo.update(tenantId, categoryId, dto.name);
  }

  async remove(tenantId: string, categoryId: string) {
    const category = await this.categoryRepo.findById(tenantId, categoryId);
    if (!category) throw new NotFoundException('Category not found');
    await this.categoryRepo.remove(categoryId);
    return { id: categoryId, deleted: true };
  }
}
