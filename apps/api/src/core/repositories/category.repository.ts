import { Category } from '../entities/category.entity';

export const CATEGORY_REPOSITORY = Symbol('ICategoryRepository');

export interface ICategoryRepository {
  findByTenant(tenantId: string): Promise<Category[]>;
  findById(tenantId: string, id: string): Promise<Category | null>;
  create(tenantId: string, name: string): Promise<Category>;
  update(tenantId: string, id: string, name: string): Promise<Category>;
  remove(id: string): Promise<void>;
}
