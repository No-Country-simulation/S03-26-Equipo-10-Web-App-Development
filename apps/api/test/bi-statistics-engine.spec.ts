import { anomalies, association, calculateStatistics, forecast, median, patterns } from '../src/modules/business-intelligence/utils/statistics-engine';
import type { DailyInput, ForecastInput, PatternsInput } from '../src/modules/business-intelligence/statistics.types';

function forecastFixture(): ForecastInput {
  // Numeric aggregate oracle. The temporal SQL that produces origins is exercised separately against PostgreSQL.
  return { at: new Date('2025-01-15T12:00:00Z'), historyStartedAt: new Date('2023-12-01T00:00:00Z'),
    months: Array.from({ length: 12 }, (_, index) => ({ month: `2024-${String(index + 1).padStart(2, '0')}`, count: 120n,
      observedDays: new Date(Date.UTC(2024, index + 1, 0)).getUTCDate() })),
    origins: Array.from({ length: 6 }, (_, index) => ({ targetMonth: `2024-${String(index + 7).padStart(2, '0')}`,
      originAt: new Date(Date.UTC(2024, index + 5, 1)), counts: [90n, 120n, 150n] })) };
}
function patternFixture(): PatternsInput {
  const tagA = '11111111-1111-4111-8111-111111111111'; const tagB = '22222222-2222-4222-8222-222222222222';
  return { total: 100n, withoutCategory: 100n, withoutTags: 50n, tagsObserved: true,
    categories: { items: [{ id: '1', name: 'Synthetic', count: 100n }], totalGroups: 1n },
    tags: { items: [{ id: tagA, name: 'Synthetic A', count: 40n }, { id: tagB, name: 'Synthetic B', count: 20n }], totalGroups: 2n },
    segments: { items: [], totalGroups: 0n }, pairs: [{ tagA, tagB, count: 10n, a: 40n, b: 20n }] };
}
function days(n = 22): DailyInput[] {
  return Array.from({ length: n }, (_, index) => { const at = new Date(Date.UTC(2025, 0, index + 1, 12));
    return { date: at.toISOString().slice(0, 10), snapshotAt: at, total: 100n, rejected: 10n, lowRating: 10n }; });
}

describe('independent statistical numeric oracles', () => {
  it('computes the middle pair without mutating the observations', () => {
    const values = [0.4, 0.1, 0.3, 0.2];
    expect(median(values)).toBe(0.25);
    expect(values).toEqual([0.4, 0.1, 0.3, 0.2]);
  });
  it('uses the inventory denominator and distinct directional confidences', () => {
    expect(association(100n, 40n, 20n, 10n)).toEqual({ support: 0.1, confidenceAB: 0.25, confidenceBA: 0.5, lift: 1.25 });
  });
  it.each([{ values: [] }, { values: [NaN] }, { values: [Infinity] }])('rejects undefined medians for $values', ({ values }) => {
    expect(() => median(values)).toThrow('BI_STATISTICS_DATA_INVALID');
  });
  it('preserves zero and the odd median', () => { expect(median([0, 9, 2])).toBe(2); });
  it.each([[0n, 0n, 0n, 0n], [100n, 40n, 20n, 21n], [10n, 9n, 9n, 1n], [-1n, 1n, 1n, 1n]])('rejects inconsistent association counts', (n, a, b, ab) => {
    expect(() => association(n, a, b, ab)).toThrow('BI_STATISTICS_DATA_INVALID');
  });
});

describe('monthly forecast promotion policy', () => {
  it('uses next calendar month, h2 and independently evaluated six origins', () => {
    const result = forecast(forecastFixture());
    expect(result).toMatchObject({ status: 'available', targetMonth: '2025-02', horizon: 2, value: 120,
      inputMonths: ['2024-10', '2024-11', '2024-12'], evaluation: { candidateMae: 0, baselineMae: 30, candidateBias: 0, baselineBias: 30 } });
    expect(result.evaluation!.folds).toHaveLength(6);
    expect(result.evaluation!.folds[0]).toMatchObject({ candidate: 120, baseline: 150, actual: '120', originAt: '2024-06-01T00:00:00.000Z' });
  });
  it('does not use the partial current month for the forecast', () => {
    const input = forecastFixture(); input.months.push({ month: '2025-01', count: 9999n, observedDays: 15 });
    expect(forecast(input).value).toBe(120);
  });
  it('requires twelve closed months strictly after the first observed month', () => {
    const input = forecastFixture(); input.historyStartedAt = new Date('2024-01-01Z');
    expect(forecast(input)).toMatchObject({ reason: 'INSUFFICIENT_HISTORY', value: null });
    input.historyStartedAt = new Date('2023-12-01Z'); input.months.shift();
    expect(forecast(input).reason).toBe('INSUFFICIENT_HISTORY');
  });
  it('handles leap-month coverage and the exact 90 percent boundary', () => {
    const input = forecastFixture(); input.months.find(row => row.month === '2024-04')!.observedDays = 27;
    expect(forecast(input).status).toBe('available');
    input.months.find(row => row.month === '2024-02')!.observedDays = 26;
    expect(forecast(input)).toMatchObject({ reason: 'INSUFFICIENT_COVERAGE', value: null });
  });
  it('withholds missing origins and rejects future or wrong-month origins', () => {
    const input = forecastFixture(); input.origins[0]!.originAt = null;
    expect(forecast(input).reason).toBe('MISSING_EVALUATION_ORIGIN');
    input.origins[0]!.originAt = new Date('2026-01-01Z');
    expect(() => forecast(input)).toThrow('BI_STATISTICS_DATA_INVALID');
  });
  it('retains history and evaluation when baseline is perfect', () => {
    const input = forecastFixture(); input.origins.forEach(row => { row.counts = [120n, 120n, 120n]; });
    expect(forecast(input)).toMatchObject({ reason: 'BASELINE_PERFECT', value: null, evaluation: { baselineMae: 0 } });
    expect(forecast(input).history).toHaveLength(12);
  });
  it('rejects ties and accepts exactly ten percent MAE improvement with decimal arithmetic', () => {
    const input = forecastFixture(); input.months.forEach(row => { row.count = 2n; });
    input.origins.forEach(row => { row.counts = [12n, 12n, 12n]; });
    expect(forecast(input).reason).toBe('NO_BASELINE_IMPROVEMENT');
    input.origins.forEach(row => { row.counts = [9n, 12n, 12n]; });
    expect(forecast(input)).toMatchObject({ status: 'available', evaluation: { candidateMae: 9, baselineMae: 10 } });
  });
  it('does not lose precision by converting excessive forecast magnitudes to Number', () => {
    const input = forecastFixture(); input.origins.forEach(row => { row.counts = [9007199254740993n, 9007199254740993n, 9007199254740993n]; });
    expect(() => forecast(input)).toThrow('BI_STATISTICS_COUNT_OUT_OF_RANGE');
  });
  it('accepts the exact promotion boundary when fold errors have repeating thirds', () => {
    const input = forecastFixture(); input.months.forEach(row => { row.count = 0n; });
    const counts = [[17n, 0n, 2n], [0n, 0n, 2n], [0n, 0n, 2n], [0n, 0n, 2n], [0n, 0n, 1n], [0n, 0n, 1n]];
    input.origins.forEach((row, index) => { row.counts = counts.at(index)!; });
    expect(forecast(input)).toMatchObject({ status: 'available', value: 0, evaluation: { candidateMae: 1.5 } });
  });
});

describe('bounded taxonomy patterns', () => {
  it('uses original inventory denominators and reports cardinality truncation', () => {
    const input = patternFixture(); input.categories.totalGroups = 55n;
    expect(patterns(input)).toMatchObject({ categories: { truncated: true, totalGroups: '55', items: [{ ratio: 1 }] },
      associations: [{ support: 0.1, confidenceAB: 0.25, confidenceBA: 0.5, lift: 1.25 }], withoutTags: { count: '50', ratio: 0.5 } });
  });
  it('distinguishes absent tag observation from empty patterns', () => {
    const input = patternFixture(); input.tagsObserved = false;
    expect(patterns(input)).toMatchObject({ status: 'available', tagsAvailability: { reason: 'TAGS_NOT_OBSERVED' },
      tags: { items: [] }, withoutTags: null, associations: [] });
  });
  it('keeps frequencies but suppresses associations with fewer than 30 testimonials', () => {
    const input = patternFixture(); input.total = 29n; input.withoutCategory = 29n; input.withoutTags = 0n;
    input.categories.items[0]!.count = 29n; input.tags.items.forEach(row => { row.count = 10n; });
    input.pairs[0]!.a = 10n; input.pairs[0]!.b = 10n;
    expect(patterns(input)).toMatchObject({ associationsAvailability: { reason: 'INSUFFICIENT_SAMPLE' }, associations: [] });
  });
  it('filters insufficient support, joint counts and lift without declaring significance', () => {
    const input = patternFixture(); input.pairs[0]!.count = 4n;
    expect(patterns(input).associations).toEqual([]);
    input.pairs[0] = { ...input.pairs[0]!, count: 6n, a: 20n, b: 25n };
    expect(patterns(input).associations[0]!.lift).toBe(1.2);
  });
  it('limits pairs to twenty and orders equal counts by lift then stable identifiers', () => {
    const input = patternFixture();
    input.tags.items = Array.from({ length: 50 }, (_, index) => ({ id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      name: `Tag ${index + 1}`, count: 10n })); input.tags.totalGroups = 55n;
    const first = input.tags.items[0]!;
    input.pairs = input.tags.items.slice(1).map(tag => ({ tagA: first.id, tagB: tag.id, count: 5n, a: 10n, b: 10n })).reverse();
    const higherLift = input.pairs[0]!; higherLift.b = 5n; input.tags.items[49]!.count = 5n;
    const result = patterns(input);
    expect(result.associations).toHaveLength(20);
    expect(result.associations.slice(0, 3).map(pair => pair.tagB))
      .toEqual([higherLift.tagB, input.tags.items[1]!.id, input.tags.items[2]!.id]);
    expect(result.tags).toMatchObject({ totalGroups: '55', truncated: true });
    expect(result.tags.items).toHaveLength(50);
  });
});

describe('descriptive anomaly signals', () => {
  const at = new Date('2025-01-22T12:00:00Z');
  it.each([[15n, 'normal'], [16n, 'flagged']] as const)('uses strict comparison at the five-point threshold for %s', (count, status) => {
    const input = days(); input[21]!.rejected = count;
    const result = anomalies(at, input); const row = result.items.find(row => row.id === 'rejected_share:2025-01-22')!;
    expect(row).toMatchObject({ status, median: 0.1, mad: 0, threshold: 0.15, baselineDays: 21, provisional: true });
    expect(result.items).toHaveLength(180);
  });
  it('distinguishes missing cuts, zero inventories, low samples and insufficient baseline', () => {
    const input = days(); input[21]!.total = 0n; input[21]!.rejected = 0n; input[21]!.lowRating = 0n;
    const result = anomalies(at, input);
    expect(result.items.find(row => row.date === '2025-01-22')).toMatchObject({ status: 'insufficient_sample', ratio: null, denominator: '0' });
    expect(result.items[0]).toMatchObject({ status: 'no_snapshot', numerator: null });
    expect(anomalies(at, days(21)).items.find(row => row.date === '2025-01-21')).toMatchObject({ status: 'insufficient_baseline', baselineDays: 20 });
  });
  it('excludes current day and reference samples below 30', () => {
    const input = days(); input[0]!.total = 29n;
    expect(anomalies(at, input).items.find(row => row.id === 'rejected_share:2025-01-22'))
      .toMatchObject({ status: 'insufficient_baseline', baselineDays: 20 });
  });
  it('accepts zero fractions, rejects duplicate days and invalid numerators', () => {
    const input = days(); input.forEach(row => { row.rejected = 0n; });
    expect(anomalies(at, input).items.find(row => row.id === 'rejected_share:2025-01-22')).toMatchObject({ status: 'normal', ratio: 0, threshold: 0.05 });
    expect(() => anomalies(at, [...input, input[0]!])).toThrow('BI_STATISTICS_DATA_INVALID');
    input[0]!.rejected = 101n; expect(() => anomalies(at, input)).toThrow('BI_STATISTICS_DATA_INVALID');
  });
  it('validates the complete persisted payload with no fabricated probability bands', () => {
    const input = forecastFixture(); input.at = at;
    const payload = calculateStatistics({ forecast: input, patterns: patternFixture(), daily: days() });
    expect(Object.keys(payload).sort()).toEqual(['anomalies', 'forecast', 'patterns']);
    expect(payload.forecast).not.toHaveProperty('confidenceInterval');
  });
  it('does not cap an exploratory threshold above one or turn it into a probability', () => {
    const input = days(); input.slice(0, 21).forEach((row, index) => { row.rejected = index < 7 ? 10n : index < 14 ? 50n : 90n; });
    input[21]!.rejected = 100n;
    expect(anomalies(at, input).items.find(row => row.id === 'rejected_share:2025-01-22'))
      .toMatchObject({ status: 'normal', median: 0.5, mad: 0.4, threshold: 2.27912 });
  });
});
