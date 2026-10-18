import { AnalyticsRepository } from '../src/modules/analytics/repositories/analytics.repository';
import { PrismaService } from '../src/modules/database/prisma.service';

describe('analytics dashboard scope and context', () => {
  const first = new Date('2024-02-01T01:00:00Z');
  function setup() {
    const db = {
      analyticsEvent: {
        groupBy: jest.fn().mockResolvedValue([{ eventTypeId: 1, _count: 80 }]),
        aggregate: jest.fn().mockResolvedValue({ _min: { createdAt: first } }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            testimonialId: 'own-id',
            createdAt: first,
            eventType: { code: 'view' },
            testimonial: {
              id: 'own-id',
              authorName: 'Autora de prueba',
              content: '😀'.repeat(180),
            },
          },
        ]),
      },
      analyticsEventType: {
        findMany: jest.fn().mockResolvedValue([{ id: 1, code: 'view' }]),
      },
      $transaction: jest.fn(),
    };
    db.$transaction.mockImplementation((read: (tx: unknown) => unknown) =>
      read(db),
    );
    return {
      db,
      repo: new AnalyticsRepository(db as unknown as PrismaService),
    };
  }
  it('keeps existing totals and adds accumulated period, observation, limit and authorized extract', async () => {
    const { repo } = setup();
    const result = (await repo.getDashboard('tenant-a')) as unknown as {
      observedAt: string;
      period: { to: string };
    };
    expect(result).toMatchObject({
      totalViews: 80,
      totalClicks: 0,
      totalPlays: 0,
      recentEventsLimit: 50,
      period: { kind: 'all_time', from: first.toISOString() },
      events: [
        {
          testimonialId: 'own-id',
          testimonial: {
            id: 'own-id',
            authorName: 'Autora de prueba',
            excerpt: '😀'.repeat(160),
          },
        },
      ],
    });
    expect(new Date(result.observedAt).getTime()).not.toBeNaN();
    expect(result.period.to).toBe(result.observedAt);
  });
  it('bounds reads and scopes both events and references, with no individual testimonial request', async () => {
    const { db, repo } = setup();
    await repo.getDashboard('tenant-a');
    for (const query of [
      db.analyticsEvent.groupBy,
      db.analyticsEvent.aggregate,
      db.analyticsEvent.findMany,
    ]) {
      expect(query).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-a',
            testimonial: { tenantId: 'tenant-a' },
          }),
        }),
      );
    }
    expect(db.analyticsEvent.findMany).toHaveBeenCalledTimes(1);
    expect(db.analyticsEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    );
  });
  it('reports no starting event for an empty tenant', async () => {
    const { db, repo } = setup();
    db.analyticsEvent.aggregate.mockResolvedValue({
      _min: { createdAt: null },
    });
    db.analyticsEvent.groupBy.mockResolvedValue([]);
    db.analyticsEvent.findMany.mockResolvedValue([]);
    expect(await repo.getDashboard('empty')).toMatchObject({
      totalViews: 0,
      events: [],
      period: { from: null, kind: 'all_time' },
    });
  });
});
