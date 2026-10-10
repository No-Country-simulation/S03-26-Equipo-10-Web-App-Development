import { z } from 'zod';
import { sessionRequest, type SessionFetch } from '@/lib/api/validated-response';

const count = z.string().regex(/^\d+$/);
const nullableNumber = z.number().finite().nullable();
const inventory = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const instant = z.string().datetime({ offset: true }).nullable();
export const biDashboardSchema = z.object({
  range: z.object({ from: date, to: date, timezone: z.literal('UTC') }),
  summary: z.object({ totalTestimonials: inventory, averageRating: nullableNumber,
    statuses: z.array(z.object({ code: z.string(), count: inventory })), views: count, clicks: count, plays: count, ctr: nullableNumber }),
  testimonialSeries: z.array(z.object({ date, snapshotAt: instant, total: inventory.nullable(), averageRating: nullableNumber })).max(366),
  engagementSeries: z.array(z.object({ date, views: count, clicks: count, plays: count, ctr: nullableNumber })).max(366),
  categories: z.array(z.object({ categoryKey: count, name: z.string(), count: inventory, averageRating: nullableNumber })),
  freshness: z.object({ status: z.enum(['not_loaded', 'fresh', 'stale']), sourceSnapshotAt: instant,
    lastPublishedAt: instant, historyStartedAt: instant, engagementHistoryStartedAt: date.nullable(), dataAgeSeconds: nullableNumber,
    staleAfterSeconds: inventory, frequencyHours: z.union([z.literal(1), z.literal(6), z.literal(24)]),
    delayToleranceMinutes: z.union([z.literal(30), z.literal(60), z.literal(120)]), schedulePaused: z.boolean() }),
}).refine(data => data.testimonialSeries.length === data.engagementSeries.length && data.testimonialSeries.every((row, index) => row.date === data.engagementSeries[index]?.date), 'Misaligned daily series');
export type BiDashboard = z.infer<typeof biDashboardSchema>;
export function getBiDashboard(fetchApi: SessionFetch, range: { from: string; to: string }, signal?: AbortSignal) {
  return sessionRequest(fetchApi, `/bi/dashboard?${new URLSearchParams(range)}`, biDashboardSchema, signal ? { signal } : undefined);
}
