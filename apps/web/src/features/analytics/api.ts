import { z } from 'zod';
import {
  sessionRequest,
  type SessionFetch,
} from '@/lib/api/validated-response';
const count = z.number().int().nonnegative().safe();
const instant = z.string().datetime({ offset: true });
const dashboardSchema = z
  .object({
    totalViews: count,
    totalClicks: count,
    totalPlays: count,
    observedAt: instant,
    period: z.object({
      kind: z.literal('all_time'),
      from: instant.nullable(),
      to: instant,
    }),
    recentEventsLimit: z.number().int().min(1).max(100),
    events: z.array(
      z
        .object({
          id: count,
          testimonialId: z.string().uuid(),
          eventType: z.enum(['view', 'click', 'play']),
          createdAt: instant,
          testimonial: z.object({
            id: z.string().uuid(),
            authorName: z.string(),
            excerpt: z.string().max(320),
          }),
        })
        .refine((event) => event.testimonialId === event.testimonial.id),
    ),
  })
  .refine(
    (data) =>
      data.events.length <= data.recentEventsLimit &&
      data.period.to === data.observedAt &&
      (data.period.from === null ||
        Date.parse(data.period.from) <= Date.parse(data.period.to)),
  );
export type AnalyticsDashboard = z.infer<typeof dashboardSchema>;
export const getAnalyticsDashboard = (fetchApi: SessionFetch) =>
  sessionRequest(fetchApi, '/analytics/dashboard', dashboardSchema);
