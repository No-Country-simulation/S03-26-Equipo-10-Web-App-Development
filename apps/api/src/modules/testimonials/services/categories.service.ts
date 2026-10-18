import { NotFoundError } from '../../../common/errors/application.error';
import { Injectable } from '@nestjs/common';
import { CategoryRepository } from '../repositories/category.repository';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/category.dto';
import type { CatalogQuery } from '../dto/admin-query';

import { CacheService } from '../../../common/services/cache.service';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categoryRepo: CategoryRepository,
    private readonly cache: CacheService,
  ) {}

  async list(tenantId: string, page: CatalogQuery = { page: 1, limit: 20 }) {
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
    const updated = await this.categoryRepo.update(
      tenantId,
      categoryId,
      dto.name,
    );
    await this.cache.invalidateTenantPublic(tenantId);
    return updated;
  }

  async remove(tenantId: string, categoryId: string) {
    const category = await this.categoryRepo.findById(tenantId, categoryId);
    if (!category) throw new NotFoundError('Category not found');
    await this.categoryRepo.remove(tenantId, categoryId);
    await this.cache.invalidateTenantPublic(tenantId);
    return { id: categoryId, deleted: true };
  }
}
