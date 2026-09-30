import { z } from 'zod';
import { sessionRequest, type SessionFetch } from '@/lib/api/validated-response';

export const testimonialSchema = z.object({
  id: z.string(), authorName: z.string(), content: z.string(),
  rating: z.number(), status: z.string(), score: z.number(), createdAt: z.string(),
  publishedAt: z.string().nullable().optional(), categoryId: z.string().nullable().optional(),
  category: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  tags: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  imageUrl: z.string().nullable().optional(), videoUrl: z.string().nullable().optional(),
  videoTitle: z.string().nullable().optional(), videoThumbnailUrl: z.string().nullable().optional(),
}).passthrough();

export const listTestimonials = (fetchApi: SessionFetch) =>
  sessionRequest(fetchApi, '/testimonials', z.array(testimonialSchema));
export const createTestimonial = (fetchApi: SessionFetch, input: object) =>
  sessionRequest(fetchApi, '/testimonials', testimonialSchema, { method: 'POST', body: JSON.stringify(input) });
export const transitionTestimonial = (fetchApi: SessionFetch, id: string, action: string, body?: object) =>
  sessionRequest(fetchApi, `/testimonials/${id}/${action}`, testimonialSchema, {
    method: 'POST', body: body ? JSON.stringify(body) : undefined,
  });
export const updateTestimonial = (fetchApi: SessionFetch, id: string, input: object) =>
  sessionRequest(fetchApi, `/testimonials/${id}`, testimonialSchema, { method: 'PATCH', body: JSON.stringify(input) });
export const attachTestimonialVideo = (fetchApi: SessionFetch, id: string, videoUrl: string) =>
  sessionRequest(fetchApi, `/testimonials/${id}/video`, testimonialSchema, {
    method: 'POST', body: JSON.stringify({ videoUrl }),
  });
export const attachTestimonialImage = (fetchApi: SessionFetch, id: string, imageBase64: string) =>
  sessionRequest(fetchApi, `/testimonials/${id}/image`, testimonialSchema, {
    method: 'POST', body: JSON.stringify({ imageBase64 }),
  });
