import { z } from 'zod';
import { publicRequest } from '@/lib/api/validated-response';

export const publicTestimonialSchema = z.object({
  id: z.string(), authorName: z.string(), content: z.string(), rating: z.number(), score: z.number(),
  imageUrl: z.string().nullable().optional(), videoUrl: z.string().nullable().optional(),
  videoTitle: z.string().nullable().optional(), videoThumbnailUrl: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
}).passthrough();

export const listPublicTestimonials = async (slug: string) =>
  (await publicRequest(`/public/testimonials/tenants/${encodeURIComponent(slug)}`, z.array(publicTestimonialSchema))).data;

export const trackPublicEvent = async (
  slug: string, testimonialId: string, eventType: 'view' | 'click' | 'play', source = 'public-page',
) => (await publicRequest(`/public/analytics/tenants/${encodeURIComponent(slug)}/events`,
  z.object({ tracked: z.boolean() }), {
    method: 'POST', body: JSON.stringify({ testimonialId, eventType, source }), keepalive: true,
  })).data;
