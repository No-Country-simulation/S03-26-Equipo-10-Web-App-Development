import { expect, it, vi } from 'vitest';
import { getAnalyticsDashboard } from './api';
import type { SessionFetch } from '@/lib/api/validated-response';
const instant = '2024-02-01T01:00:00Z';
const id = '11111111-1111-4111-8111-111111111111';
const data = {
  totalViews: 0,
  totalClicks: 0,
  totalPlays: 0,
  observedAt: instant,
  period: { kind: 'all_time', from: null, to: instant },
  recentEventsLimit: 50,
  events: [
    {
      id: 1,
      testimonialId: id,
      testimonial: { id, authorName: 'Autora', excerpt: 'Extracto' },
      eventType: 'view',
      createdAt: instant,
    },
  ],
};
it('validates accumulated metadata and preserves linked context', async () => {
  const fetch = vi.fn().mockResolvedValue({ success: true, data });
  expect((await getAnalyticsDashboard(fetch as SessionFetch)).data).toEqual(
    data,
  );
  expect(fetch).toHaveBeenCalledWith('/analytics/dashboard', undefined);
});
it.each([
  { ...data, observedAt: 'ayer' },
  { ...data, totalViews: -1 },
  { ...data, recentEventsLimit: 0 },
  { ...data, recentEventsLimit: 1, events: [...data.events, ...data.events] },
  { ...data, period: { ...data.period, to: '2024-02-02T01:00:00Z' } },
  {
    ...data,
    events: [
      {
        ...data.events[0],
        testimonial: {
          ...data.events[0].testimonial,
          id: '22222222-2222-4222-8222-222222222222',
        },
      },
    ],
  },
])(
  'fails closed for inconsistent metrics and linked references %#',
  async (payload) => {
    await expect(
      getAnalyticsDashboard(
        vi
          .fn()
          .mockResolvedValue({ success: true, data: payload }) as SessionFetch,
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  },
);
