import { Testimonial, TestimonialStatus } from '../entities/testimonial.model';

export const TESTIMONIAL_REPOSITORY = Symbol('ITestimonialRepository');

export interface PublishedFilters {
  q?: string;
  tag?: string;
  category?: string;
  sort?: 'score:desc' | 'publishedAt:desc';
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

export interface ITestimonialRepository {
  findById(tenantId: string, id: string): Promise<Testimonial | null>;
  save(entity: Testimonial): Promise<void>;
  remove(tenantId: string, id: string): Promise<void>;
  findByTenant(tenantId: string): Promise<Testimonial[]>;
  findPublished(tenantId: string, filters: PublishedFilters): Promise<PaginatedResult<Testimonial>>;
  findPublishedById(tenantId: string, id: string): Promise<Testimonial | null>;
  resolveStatusId(code: TestimonialStatus): Promise<number>;
}
