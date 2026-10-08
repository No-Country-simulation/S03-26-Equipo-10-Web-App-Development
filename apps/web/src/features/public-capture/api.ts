import { z } from 'zod';
import { publicRequest } from '@/lib/api/validated-response';

const formInfoSchema = z.object({ name: z.string(), isPublicFormEnabled: z.boolean(), logoUrl: z.string().url().nullable() });
const mediaSchema = z.enum(['image', 'video']);
const submissionSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('success'), id: z.string().min(1), failedMedia: z.array(mediaSchema).length(0) }),
  z.object({ status: z.literal('partial'), id: z.string().min(1), failedMedia: z.array(mediaSchema).nonempty() }),
]);
export type PublicSubmissionResult = z.infer<typeof submissionSchema>;

export type PublicTestimonialInput = {
  authorName: string;
  content: string;
  rating: number;
  videoUrl?: string;
  imageBase64?: string;
};

export const getFormInfo = async (slug: string) =>
  (await publicRequest(`/public/testimonials/${encodeURIComponent(slug)}/form-info`, formInfoSchema)).data;
export const submitPublicTestimonial = async (slug: string, input: PublicTestimonialInput) =>
  (await publicRequest(`/public/testimonials/${encodeURIComponent(slug)}/submit`, submissionSchema, {
    method: 'POST', body: JSON.stringify(input),
  })).data;
