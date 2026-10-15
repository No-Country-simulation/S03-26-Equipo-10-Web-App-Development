import { z } from 'zod';
import { InvalidInputError } from '../../../common/errors/application.error';
import {
  parseAdminPage,
  type AdminPage,
} from '../../../common/pagination/admin-page';
import type { TestimonialStatus } from '../entities/testimonial.model';

export interface CatalogQuery extends AdminPage {
  q?: string | undefined;
}
export interface TestimonialQuery extends CatalogQuery {
  status?: TestimonialStatus | undefined;
  categoryId?: string | undefined;
  tagIds?: string[] | undefined;
  sort?: 'createdAt:desc' | 'score:desc' | undefined;
}
const catalogFilters = z.object({
  q: z
    .string()
    .max(200)
    .transform((value) => value.trim() || undefined)
    .optional(),
});
const testimonialFilters = catalogFilters.extend({
  status: z
    .enum(['draft', 'pending', 'approved', 'published', 'rejected'])
    .optional(),
  categoryId: z.uuid().optional(),
  tagIds: z.preprocess(
    (value) => (typeof value === 'string' ? [value] : value),
    z
      .array(z.uuid())
      .max(20)
      .transform((value) => [...new Set(value)])
      .optional(),
  ),
  sort: z.enum(['createdAt:desc', 'score:desc']).optional(),
});
export function parseCatalogQuery(
  query: Record<string, unknown>,
): CatalogQuery {
  const result = catalogFilters.safeParse(query);
  if (!result.success)
    throw new InvalidInputError('Invalid catalog search query');
  return { ...parseAdminPage(query), ...result.data };
}
export function parseTestimonialQuery(
  query: Record<string, unknown>,
): TestimonialQuery {
  const result = testimonialFilters.safeParse(query);
  if (!result.success)
    throw new InvalidInputError('Invalid testimonial search query');
  return { ...parseAdminPage(query), ...result.data };
}
