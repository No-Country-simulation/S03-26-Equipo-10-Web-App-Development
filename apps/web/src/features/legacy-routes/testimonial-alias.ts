import { z } from 'zod';
import { testimonialLocation } from '@/features/testimonials/query';
/** Both old detail/edit entries resolve to the authorized contextual review.
 * Editing is available there only for the existing role/ownership/status policy.
 */
export function contextualTestimonialAlias(id: string): string | null {
  const valid = z.string().uuid().safeParse(id);
  return valid.success
    ? testimonialLocation(1, {}, valid.data.toLowerCase())
    : null;
}
