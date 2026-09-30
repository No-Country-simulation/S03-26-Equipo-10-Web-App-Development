import { z } from 'zod';
import { publicRequest } from '@/lib/api/validated-response';

const formInfoSchema = z.object({ name: z.string(), isPublicFormEnabled: z.boolean() });
const submissionSchema = z.object({ status: z.enum(['received', 'success']), id: z.string().optional() });

export const getFormInfo = async (slug: string) =>
  (await publicRequest(`/public/testimonials/${encodeURIComponent(slug)}/form-info`, formInfoSchema)).data;
export const submitPublicTestimonial = async (slug: string, input: object) =>
  (await publicRequest(`/public/testimonials/${encodeURIComponent(slug)}/submit`, submissionSchema, {
    method: 'POST', body: JSON.stringify(input),
  })).data;
