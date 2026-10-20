import { StatisticsReadService } from '../src/modules/business-intelligence/services/statistics-read.service';
import { calculateStatistics } from '../src/modules/business-intelligence/utils/statistics-engine';
const at = new Date('2025-01-15T12:00:00Z');
const report = () =>
  calculateStatistics({
    forecast: { at, historyStartedAt: at, months: [], origins: [] },
    patterns: {
      total: 0n,
      tagsObserved: true,
      withoutCategory: 0n,
      withoutTags: 0n,
      categories: { items: [], totalGroups: 0n },
      tags: { items: [], totalGroups: 0n },
      segments: { items: [], totalGroups: 0n },
      pairs: [],
    },
    daily: [],
  });
const state = () => ({
  now: at,
  latestRunId: 'source',
  historyStartedAt: at,
  tagHistoryStartedAt: at,
  publication: { sourceRunId: 'source', sourceSnapshotAt: at, generatedAt: at },
  payload: report(),
});
describe('statistics presentation without recomputing published results', () => {
  const reads = { read: jest.fn() };
  const preferences = { settings: jest.fn() };
  const service = new StatisticsReadService(reads, preferences);
  beforeEach(() => {
    reads.read.mockReset().mockResolvedValue(state());
    preferences.settings.mockResolvedValue({
      frequencyHours: 1,
      delayToleranceMinutes: 60,
      scheduleEnabled: true,
    });
  });
  it('reports unknown counts and clock-anchored windows before a publication exists', async () => {
    reads.read.mockResolvedValue({
      ...state(),
      latestRunId: null,
      publication: null,
      payload: null,
      historyStartedAt: null,
      tagHistoryStartedAt: null,
    });
    const result = await service.get('tenant');
    expect(result).toMatchObject({
      publicationStatus: 'not_loaded',
      publication: null,
      forecast: { reason: 'NOT_LOADED', targetMonth: '2025-02', value: null },
      patterns: { totalTestimonials: null },
      anomalies: { from: '2024-10-18', to: '2025-01-15', items: [] },
    });
    expect(reads.read).toHaveBeenCalledWith('tenant');
  });
  it('distinguishes pending computation from an empty observed inventory', async () => {
    reads.read.mockResolvedValue({
      ...state(),
      publication: null,
      payload: null,
    });
    expect(await service.get('tenant')).toMatchObject({
      publicationStatus: 'pending',
      patterns: { totalTestimonials: null },
    });
    reads.read.mockResolvedValue(state());
    expect(await service.get('tenant')).toMatchObject({
      publicationStatus: 'current',
      patterns: { totalTestimonials: '0', status: 'available' },
    });
  });
  it('keeps historical patterns but withholds a forecast from an older publication', async () => {
    reads.read.mockResolvedValue({ ...state(), latestRunId: 'newer' });
    expect(await service.get('tenant')).toMatchObject({
      publicationStatus: 'outdated',
      forecast: { reason: 'STALE_PUBLICATION', value: null },
      patterns: { totalTestimonials: '0' },
    });
  });
  it('uses source age and configured tolerance even while paused; month rollover takes precedence', async () => {
    preferences.settings.mockResolvedValue({
      frequencyHours: 1,
      delayToleranceMinutes: 30,
      scheduleEnabled: false,
    });
    reads.read.mockResolvedValue({
      ...state(),
      now: new Date('2025-01-15T14:00:00Z'),
    });
    expect(await service.get('tenant')).toMatchObject({
      freshness: {
        status: 'stale',
        dataAgeSeconds: 7200,
        staleAfterSeconds: 5400,
        schedulePaused: true,
      },
      forecast: { reason: 'STALE_PUBLICATION' },
    });
    reads.read.mockResolvedValue({ ...state(), now: new Date('2025-02-01Z') });
    expect(await service.get('tenant')).toMatchObject({
      forecast: {
        reason: 'TARGET_OUTDATED',
        value: null,
        targetMonth: '2025-02',
      },
    });
  });
});
