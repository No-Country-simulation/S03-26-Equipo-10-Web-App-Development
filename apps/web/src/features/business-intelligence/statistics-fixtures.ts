import type { BiStatistics } from './statistics-api';
export function statisticsFixture(): BiStatistics {
  const at = '2025-01-22T12:00:00.000Z';
  const unavailable = {
    status: 'unavailable' as const,
    reason: 'INSUFFICIENT_HISTORY' as const,
  };
  const empty = { items: [], totalGroups: '0', truncated: false };
  const available = { status: 'available' as const, reason: null };
  return {
    observedAt: at,
    timezone: 'UTC',
    algorithmVersion: 'stats_v1',
    publicationStatus: 'current',
    publication: {
      sourceRunId: '11111111-1111-4111-8111-111111111111',
      sourceSnapshotAt: at,
      generatedAt: at,
    },
    coverage: {
      historyStartedAt: '2025-01-01T00:00:00.000Z',
      tagHistoryStartedAt: at,
      creationsScope: 'observed_only',
    },
    freshness: {
      status: 'fresh',
      dataAgeSeconds: 0,
      staleAfterSeconds: 7200,
      frequencyHours: 1,
      delayToleranceMinutes: 60,
      schedulePaused: false,
    },
    forecast: {
      ...unavailable,
      targetMonth: '2025-02',
      method: 'moving_average_3_constant',
      horizon: 2,
      value: null,
      inputMonths: [],
      history: [
        {
          month: '2024-12',
          count: null,
          observedDays: 0,
          calendarDays: 31,
          coverage: 0,
          partial: false,
        },
        {
          month: '2025-01',
          count: '9007199254740993',
          observedDays: 22,
          calendarDays: 31,
          coverage: 1,
          partial: true,
        },
      ],
      evaluation: null,
    },
    patterns: {
      ...available,
      totalTestimonials: '100',
      categories: {
        items: [
          { id: '1', name: 'Atención al cliente', count: '100', ratio: 1 },
        ],
        totalGroups: '1',
        truncated: false,
      },
      tags: {
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'Respuesta rápida',
            count: '40',
            ratio: 0.4,
          },
          {
            id: '22222222-2222-4222-8222-222222222222',
            name: 'Soporte',
            count: '20',
            ratio: 0.2,
          },
        ],
        totalGroups: '2',
        truncated: false,
      },
      tagsAvailability: available,
      associationsAvailability: available,
      withoutCategory: { count: '0', ratio: 0 },
      withoutTags: { count: '50', ratio: 0.5 },
      segments: empty,
      associations: [
        {
          tagA: '11111111-1111-4111-8111-111111111111',
          tagB: '22222222-2222-4222-8222-222222222222',
          count: '10',
          support: 0.1,
          confidenceAB: 0.25,
          confidenceBA: 0.5,
          lift: 1.25,
        },
      ],
    },
    anomalies: {
      ...available,
      from: '2024-10-25',
      to: '2025-01-22',
      items: Array.from({ length: 90 }, (_, i) => {
        const date = new Date(Date.parse('2024-10-25') + i * 86400000)
          .toISOString()
          .slice(0, 10);
        return (['low_rating_share', 'rejected_share'] as const).map(
          (metric) => ({
            id: `${metric}:${date}`,
            date,
            metric,
            provisional: i === 89,
            snapshotAt: i === 89 ? at : null,
            numerator: i === 89 ? '16' : null,
            denominator: i === 89 ? '100' : null,
            ratio: i === 89 ? 0.16 : null,
            baselineDays: i === 89 ? 21 : 0,
            median: i === 89 ? 0.1 : null,
            mad: i === 89 ? 0 : null,
            threshold: i === 89 ? 0.15 : null,
            status: i === 89 ? ('flagged' as const) : ('no_snapshot' as const),
          }),
        );
      }).flat(),
    },
  };
}

export function unpublishedStatisticsFixture(): BiStatistics {
  const data = statisticsFixture();
  const unavailable = {
    status: 'unavailable' as const,
    reason: 'NOT_LOADED' as const,
  };
  const empty = { items: [], totalGroups: '0', truncated: false };
  return {
    ...data,
    publication: null,
    publicationStatus: 'pending',
    freshness: {
      ...data.freshness,
      status: 'not_loaded',
      dataAgeSeconds: null,
    },
    forecast: {
      ...data.forecast,
      ...unavailable,
      history: [],
      inputMonths: [],
      evaluation: null,
      value: null,
    },
    patterns: {
      ...unavailable,
      totalTestimonials: null,
      categories: empty,
      tags: empty,
      tagsAvailability: unavailable,
      associationsAvailability: unavailable,
      withoutCategory: null,
      withoutTags: null,
      segments: empty,
      associations: [],
    },
    anomalies: { ...data.anomalies, ...unavailable, items: [] },
  };
}
