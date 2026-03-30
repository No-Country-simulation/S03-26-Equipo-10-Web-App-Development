import { Tag } from '../entities/tag.model';

export const TAG_REPOSITORY = Symbol('ITagRepository');

export interface ITagRepository {
  findByTenant(tenantId: string): Promise<Tag[]>;
  findById(tenantId: string, id: string): Promise<Tag | null>;
  create(tenantId: string, name: string): Promise<Tag>;
  update(tenantId: string, id: string, name: string): Promise<Tag>;
  remove(id: string): Promise<void>;
}
