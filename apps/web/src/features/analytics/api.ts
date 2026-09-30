import { z } from 'zod';
import { sessionRequest, type SessionFetch } from '@/lib/api/validated-response';

const dashboardSchema = z.object({
  totalViews: z.number(), totalClicks: z.number(), totalPlays: z.number(),
  events: z.array(z.object({
    id: z.number(), testimonialId: z.string(), eventType: z.string(), createdAt: z.string(),
  }).passthrough()),
}).passthrough();

export const getAnalyticsDashboard = (fetchApi: SessionFetch) =>
  sessionRequest(fetchApi, '/analytics/dashboard', dashboardSchema);
