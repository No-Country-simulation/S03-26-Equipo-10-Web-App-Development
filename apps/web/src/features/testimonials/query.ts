import { z } from 'zod';

export const testimonialStates = [
  'draft',
  'pending',
  'approved',
  'published',
  'rejected',
] as const;
export type TestimonialFilters = {
  q?: string;
  status?: (typeof testimonialStates)[number];
  categoryId?: string;
  tagIds?: string[];
  sort?: 'createdAt:desc' | 'score:desc';
};
const resourceId = z
  .string()
  .uuid()
  .transform((id) => id.toLowerCase());
const locationSchema = z.object({
  page: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .refine((page) => Number.isSafeInteger(page) && page <= 10000),
  q: z.string().max(200),
  status: z.enum(testimonialStates).optional(),
  categoryId: resourceId.optional(),
  tagIds: z.array(resourceId).max(20),
  sort: z.enum(['createdAt:desc', 'score:desc']),
  testimonial: resourceId.optional(),
});
export function readTestimonialLocation(search: string) {
  const params = new URLSearchParams(search);
  // Single-value parameters cannot be repeated: never silently change a shared query.
  const duplicate = [
    'page',
    'q',
    'status',
    'categoryId',
    'sort',
    'testimonial',
  ].some((key) => params.getAll(key).length > 1);
  const parsed = locationSchema.safeParse({
    page: params.get('page') ?? '1',
    q: params.get('q') ?? '',
    status: params.get('status') || undefined,
    categoryId: params.get('categoryId') || undefined,
    tagIds: params.getAll('tagIds'),
    sort: params.get('sort') ?? 'createdAt:desc',
    testimonial: params.get('testimonial') || undefined,
  });
  if (duplicate || !parsed.success) return { valid: false as const };
  const { page, testimonial, ...filters } = parsed.data;
  return {
    valid: true as const,
    page,
    testimonial,
    filters: { ...filters, tagIds: [...new Set(filters.tagIds)] },
  };
}
export function appendTestimonialFilters(
  params: URLSearchParams,
  filters: TestimonialFilters,
) {
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.status) params.set('status', filters.status);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  for (const id of filters.tagIds ?? []) params.append('tagIds', id);
  if (filters.sort && filters.sort !== 'createdAt:desc')
    params.set('sort', filters.sort);
  return params;
}
export function testimonialLocation(
  page: number,
  filters: TestimonialFilters,
  testimonial?: string,
) {
  const params = appendTestimonialFilters(
    new URLSearchParams({ page: String(page) }),
    filters,
  );
  if (testimonial) params.set('testimonial', testimonial);
  return `/admin/testimonials?${params}`;
}
