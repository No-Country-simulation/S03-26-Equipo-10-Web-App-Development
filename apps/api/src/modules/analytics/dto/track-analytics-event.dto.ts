import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const TrackAnalyticsEventSchema = z.object({
  testimonialId: z.string().uuid(),
  eventType: z.enum(['view', 'click', 'play']),
  source: z.string().optional(),
});
export class TrackAnalyticsEventDto extends createZodDto(TrackAnalyticsEventSchema) {}
