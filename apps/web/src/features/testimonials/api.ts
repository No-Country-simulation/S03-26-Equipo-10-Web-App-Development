import { z } from 'zod';
import { ApiError } from '@/lib/api';
import {
  sessionRequest,
  deletedSchema,
  type SessionFetch,
} from '@/lib/api/validated-response';
import { sessionPageRequest } from '@/features/shared/pagination';

import { appendTestimonialFilters, type TestimonialFilters } from './query';

export const testimonialSchema = z
  .object({
    id: z.string(),
    createdById: z.string().nullable(),
    authorName: z.string(),
    content: z.string(),
    rating: z.number(),
    status: z.string(),
    score: z.number(),
    createdAt: z.string(),
    publishedAt: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    category: z
      .object({ id: z.string(), name: z.string() })
      .nullable()
      .optional(),
    tags: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
    imageUrl: z.string().nullable().optional(),
    videoUrl: z.string().nullable().optional(),
    videoTitle: z.string().nullable().optional(),
    videoThumbnailUrl: z.string().nullable().optional(),
  })
  .passthrough();

export const listTestimonials = async (
  fetchApi: SessionFetch,
  page = 1,
  filters: TestimonialFilters = {},
  limit = 20,
) => {
  const response = await sessionPageRequest(
    fetchApi,
    `/testimonials?${appendTestimonialFilters(new URLSearchParams({ page: String(page), limit: String(limit) }), filters)}`,
    testimonialSchema,
  );
  if (response.data.meta.page !== page || response.data.meta.limit !== limit) {
    throw new ApiError(
      'El servidor devolvió una página diferente a la solicitada.',
      'INVALID_RESPONSE',
    );
  }
  return response;
};
export const getTestimonial = (fetchApi: SessionFetch, id: string) => {
  const validId = z.string().uuid().parse(id).toLowerCase();
  return sessionRequest(
    fetchApi,
    `/testimonials/${validId}`,
    testimonialSchema.refine((record) => record.id === validId),
  );
};
export const deleteTestimonial = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(
    fetchApi,
    `/testimonials/${encodeURIComponent(id)}`,
    deletedSchema.extend({ id: z.literal(id), deleted: z.literal(true) }),
    { method: 'DELETE' },
  );
const count = z.number().int().nonnegative();
export const testimonialSummarySchema = z
  .object({
    total: count,
    byStatus: z.object({
      draft: count,
      pending: count,
      approved: count,
      published: count,
      rejected: count,
    }),
  })
  .refine(
    (value) =>
      Object.values(value.byStatus).reduce((sum, n) => sum + n, 0) ===
      value.total,
    'Inconsistent testimonial totals',
  );
export const getTestimonialSummary = (fetchApi: SessionFetch) =>
  sessionRequest(fetchApi, '/testimonials/summary', testimonialSummarySchema);
export type CreateTestimonialInput = {
  authorName: string;
  content: string;
  rating: number;
  categoryId?: string;
  tagIds?: string[];
};
export type UpdateTestimonialInput = Partial<CreateTestimonialInput>;
export type TestimonialTransition = 'submit' | 'approve' | 'publish' | 'reject';

export const createTestimonial = (
  fetchApi: SessionFetch,
  input: CreateTestimonialInput,
) =>
  sessionRequest(fetchApi, '/testimonials', testimonialSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const transitionTestimonial = (
  fetchApi: SessionFetch,
  id: string,
  action: TestimonialTransition,
  body?: { reason: string },
) =>
  sessionRequest(fetchApi, `/testimonials/${id}/${action}`, testimonialSchema, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
export const updateTestimonial = (
  fetchApi: SessionFetch,
  id: string,
  input: UpdateTestimonialInput,
) =>
  sessionRequest(fetchApi, `/testimonials/${id}`, testimonialSchema, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
export const attachTestimonialVideo = (
  fetchApi: SessionFetch,
  id: string,
  videoUrl: string,
) =>
  sessionRequest(fetchApi, `/testimonials/${id}/video`, testimonialSchema, {
    method: 'POST',
    body: JSON.stringify({ videoUrl }),
  });
export const attachTestimonialImage = (
  fetchApi: SessionFetch,
  id: string,
  imageBase64: string,
) =>
  sessionRequest(fetchApi, `/testimonials/${id}/image`, testimonialSchema, {
    method: 'POST',
    body: JSON.stringify({ imageBase64 }),
  });
