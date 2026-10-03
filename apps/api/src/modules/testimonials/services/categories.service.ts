import { NotFoundError } from '../../../common/errors/application.error';
import { Injectable } from '@nestjs/common';
import { CategoryRepository } from '../repositories/category.repository';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/category.dto';
import type { AdminPage } from '../../../common/pagination/admin-page';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoryRepo: CategoryRepository,
  ) {}

  async list(tenantId: string, page: AdminPage = { page: 1, limit: 20 }) {
    const categories = await this.categoryRepo.findByTenant(tenantId, page);
    return {
      items: categories.items,
      meta: { total: categories.total, page: page.page, limit: page.limit },
    };
  }

  async getCategory(tenantId: string, categoryId: string) {
    const category = await this.categoryRepo.findById(tenantId, categoryId);
    if (!category) throw new NotFoundError('Category not found');
    return category;
  }

  async create(tenantId: string, dto: CreateCategoryDto) {
    return this.categoryRepo.create(tenantId, dto.name);
  }

  async update(tenantId: string, categoryId: string, dto: UpdateCategoryDto) {
    const category = await this.categoryRepo.findById(tenantId, categoryId);
    if (!category) throw new NotFoundError('Category not found');
    return this.categoryRepo.update(tenantId, categoryId, dto.name);
  }

  async remove(tenantId: string, categoryId: string) {
    const category = await this.categoryRepo.findById(tenantId, categoryId);
    if (!category) throw new NotFoundError('Category not found');
    await this.categoryRepo.remove(tenantId, categoryId);
    return { id: categoryId, deleted: true };
  }
}
