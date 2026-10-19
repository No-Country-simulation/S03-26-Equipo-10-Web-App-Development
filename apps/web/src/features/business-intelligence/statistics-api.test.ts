import { describe, it, expect, vi } from 'vitest';
import { getBiStatistics, statisticsSchema } from './statistics-api';
import { statisticsFixture } from './statistics-fixtures';
import { biHref, parseBiQuery } from './query';
import { buildStatisticsCsv } from './statistics-csv';
describe('statistics contracts, windows and CSV equivalence', () => {
  it('reads without query parameters and validates the three published sections', async () => {
    const data = statisticsFixture();
    const fetch = vi.fn().mockResolvedValue({ success: true, data });
    const controller = new AbortController();
    expect((await getBiStatistics(fetch, controller.signal)).data).toEqual(
      data,
    );
    expect(fetch).toHaveBeenCalledWith('/bi/statistics', {
      signal: controller.signal,
    });
  });
  it.each([
    'numeric-count',
    'unknown-version',
    'duplicate-signal',
    'invalid-availability',
    'nonfinite',
    'mixed-source',
  ])('rejects %s instead of presenting an empty report', async (kind) => {
    const data = statisticsFixture();
    if (kind === 'numeric-count')
      Reflect.set(data.patterns, 'totalTestimonials', 100);
    if (kind === 'unknown-version')
      Reflect.set(data, 'algorithmVersion', 'stats_v2');
    if (kind === 'duplicate-signal')
      data.anomalies.items[1] = data.anomalies.items[0];
    if (kind === 'invalid-availability') data.forecast.status = 'available';
    if (kind === 'nonfinite') data.patterns.associations[0].lift = Infinity;
    if (kind === 'mixed-source')
      data.publication!.sourceSnapshotAt = '2025-01-21T12:00:00.000Z';
    await expect(
      getBiStatistics(vi.fn().mockResolvedValue({ success: true, data })),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('clears inherited summary windows when navigating to statistics', () => {
    expect(
      biHref(
        new URLSearchParams(
          'from=2024-01-01&to=2024-02-01&tenant=foreign&view=summary',
        ),
        { view: 'statistics' },
      ),
    ).toBe('/admin/business-intelligence?view=statistics');
    expect(
      parseBiQuery(
        new URLSearchParams('view=statistics&from=2000-01-01&to=2024-01-01'),
      ).query?.view,
    ).toBe('statistics');
  });
  it('exports exact counts, unknowns, metadata, percentages and directional confidence', () => {
    const data = statisticsFixture();
    const forecast = buildStatisticsCsv(data, 'forecast');
    expect(forecast.content).toContain('9007199254740993');
    expect(forecast.content).toContain('"historico","2024-12",""');
    expect(forecast.content).toContain(
      '"stats_v1","UTC","2025-01-22T12:00:00.000Z"',
    );
    const patterns = buildStatisticsCsv(data, 'patterns');
    expect(patterns.content).toContain('"10","25","50","1.25"');
    expect(patterns.content).toContain('"sin_categoria","","","","0","0"');
    const anomalies = buildStatisticsCsv(data, 'anomalies');
    expect(anomalies.content.split('\r\n')).toHaveLength(182);
    expect(anomalies.content).toContain(
      '"16","100","16","21","10","0","15","flagged"',
    );
    expect(anomalies.content.startsWith('\uFEFF')).toBe(true);
    expect(statisticsSchema.parse(data)).toEqual(data);
  });
  it('neutralizes formula names, escapes quotes and blocks export before publication', () => {
    const data = statisticsFixture();
    data.patterns.categories.items[0].name = '  =HYPERLINK("unsafe")';
    expect(buildStatisticsCsv(data, 'patterns').content).toContain(
      `"'  =HYPERLINK(""unsafe"")"`,
    );
    data.publication = null;
    expect(() => buildStatisticsCsv(data, 'forecast')).toThrow(
      'Publication required',
    );
  });
});
