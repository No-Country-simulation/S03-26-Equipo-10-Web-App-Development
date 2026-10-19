import { ApiError } from '@/lib/api';
import { pageMetaSchema } from '@/features/shared/pagination';
import { z } from 'zod';
import { publicRequest } from '@/lib/api/validated-response';

export const publicTestimonialSchema = z
  .object({
    id: z.string(),
    authorName: z.string(),
    content: z.string(),
    rating: z.number().int().min(1).max(5),
    score: z.number(),
    imageUrl: z.string().nullable().optional(),
    videoUrl: z.string().nullable().optional(),
    videoTitle: z.string().nullable().optional(),
    videoThumbnailUrl: z.string().nullable().optional(),
    publishedAt: z.string().nullable().optional(),
  })
  .passthrough();
export type PublicTestimonial = z.infer<typeof publicTestimonialSchema>;

export const listPublicTestimonials = async (
  slug: string,
  page = 1,
  signal?: AbortSignal,
) => {
  const response = await publicRequest(
    `/public/testimonials/tenants/${encodeURIComponent(slug)}?page=${page}&limit=20`,
    z.array(publicTestimonialSchema),
    { signal },
  );
  const meta = pageMetaSchema.safeParse(response.meta);
  if (
    !meta.success ||
    meta.data.page !== page ||
    meta.data.limit !== 20 ||
    response.data.length > 20 ||
    new Set(response.data.map((item) => item.id)).size !== response.data.length
  )
    throw new ApiError(
      'El servidor devolvió una paginación inválida.',
      'INVALID_RESPONSE',
    );
  return { items: response.data, meta: meta.data };
};

export const trackPublicEvent = async (
  slug: string,
  testimonialId: string,
  eventType: 'view' | 'click' | 'play',
  source = 'public-page',
) =>
  (
    await publicRequest(
      `/public/analytics/tenants/${encodeURIComponent(slug)}/events`,
      z.object({ tracked: z.boolean() }),
      {
        method: 'POST',
        body: JSON.stringify({ testimonialId, eventType, source }),
        keepalive: true,
      },
    )
  ).data;
