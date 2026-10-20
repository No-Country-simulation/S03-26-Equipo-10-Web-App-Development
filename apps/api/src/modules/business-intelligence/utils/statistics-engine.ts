import { Prisma } from '@prisma/client';
import { available, unavailable, StatisticsError, statisticsPayloadSchema,
  type DailyInput, type ForecastInput, type PatternsInput, type StatisticsInputs, type StatisticsPayload } from '../statistics.types';

type Decimal = Prisma.Decimal;
const decimal = (value: bigint | number | string) => new Prisma.Decimal(value.toString());
function finite(value: Decimal): number {
  if (!value.isFinite() || value.abs().gt(Number.MAX_SAFE_INTEGER)) throw new StatisticsError('BI_STATISTICS_COUNT_OUT_OF_RANGE');
  return value.toNumber();
}
function nonnegative(...values: bigint[]): void {
  if (values.some(value => value < 0n)) throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
}
function decimalMedian(values: Decimal[]): Decimal {
  if (!values.length || values.some(value => !value.isFinite())) throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
  const sorted = [...values].sort((a, b) => a.comparedTo(b)); const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted.at(middle)! : sorted.at(middle - 1)!.plus(sorted.at(middle)!).div(2);
}
export function median(values: readonly number[]): number { return finite(decimalMedian(values.map(decimal))); }
export function association(total: bigint, a: bigint, b: bigint, together: bigint) {
  nonnegative(total, a, b, together);
  if (!total || !a || !b || a > total || b > total || together > a || together > b || a + b - together > total) {
    throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
  }
  return { support: finite(decimal(together).div(decimal(total))), confidenceAB: finite(decimal(together).div(decimal(a))),
    confidenceBA: finite(decimal(together).div(decimal(b))), lift: finite(decimal(together).mul(decimal(total)).div(decimal(a).mul(decimal(b)))) };
}
export function monthOffset(month: string, offset: number): string {
  const at = new Date(month + '-01T00:00:00.000Z'); at.setUTCMonth(at.getUTCMonth() + offset);
  if (!Number.isFinite(at.getTime()) || at.getUTCFullYear() < 1 || at.getUTCFullYear() > 9999) throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
  return at.toISOString().slice(0, 7);
}
const daysInMonth = (month: string) => (Date.parse(monthOffset(month, 1) + '-01') - Date.parse(month + '-01')) / 86400000;
const mean = (values: readonly bigint[]) => values.reduce((sum, value) => sum.plus(decimal(value)), decimal(0)).div(values.length);

export function forecast(input: ForecastInput): StatisticsPayload['forecast'] {
  const current = input.at.toISOString().slice(0, 7); const start = input.historyStartedAt.toISOString().slice(0, 7);
  const byMonth = new Map(input.months.map(row => [row.month, row]));
  if (byMonth.size !== input.months.length || input.months.length > 24) throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
  const history = input.months.map(row => {
    nonnegative(row.count); const calendarDays = daysInMonth(row.month);
    const denominator = row.month === current ? input.at.getUTCDate() : calendarDays;
    if (!Number.isInteger(row.observedDays) || row.observedDays < 0 || row.observedDays > denominator) throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
    return { ...row, count: row.observedDays ? row.count.toString() : null, calendarDays,
      coverage: row.observedDays / denominator, partial: row.month === start || row.month === current };
  }).sort((a, b) => a.month.localeCompare(b.month));
  const result: StatisticsPayload['forecast'] = { ...unavailable('INSUFFICIENT_HISTORY'), targetMonth: monthOffset(current, 1),
    method: 'moving_average_3_constant', horizon: 2, value: null, inputMonths: [], history, evaluation: null };
  const required = Array.from({ length: 12 }, (_, index) => monthOffset(current, index - 12));
  if (required.some(month => month <= start || !byMonth.has(month))) return result;
  if (required.some(month => byMonth.get(month)!.observedDays * 10 < daysInMonth(month) * 9)) {
    return { ...result, ...unavailable('INSUFFICIENT_COVERAGE') };
  }
  const origins = new Map(input.origins.map(row => [row.targetMonth, row]));
  const folds: NonNullable<typeof result.evaluation>['folds'] = [];
  const candidateErrors: Decimal[] = []; const baselineErrors: Decimal[] = [];
  let candidateAbsoluteThirds = 0n; let baselineAbsolute = 0n;
  for (const targetMonth of required.slice(-6)) {
    const origin = origins.get(targetMonth);
    if (!origin?.originAt || origin.counts.length !== 3) return { ...result, ...unavailable('MISSING_EVALUATION_ORIGIN') };
    const originMonth = origin.originAt.toISOString().slice(0, 7);
    if (originMonth !== monthOffset(targetMonth, -1) || origin.originAt > input.at) throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
    nonnegative(...origin.counts);
    const actual = byMonth.get(targetMonth)!.count; const candidate = mean(origin.counts); const baseline = decimal(origin.counts[2]!);
    const thirds = origin.counts.reduce((sum, value) => sum + value, 0n) - 3n * actual;
    const base = origin.counts[2]! - actual;
    candidateAbsoluteThirds += thirds < 0n ? -thirds : thirds; baselineAbsolute += base < 0n ? -base : base;
    candidateErrors.push(candidate.minus(decimal(actual))); baselineErrors.push(baseline.minus(decimal(actual)));
    folds.push({ targetMonth, originAt: origin.originAt.toISOString(), actual: actual.toString(), candidate: finite(candidate), baseline: finite(baseline) });
  }
  const average = (values: Decimal[], absolute = false) => values.reduce((sum, value) => sum.plus(absolute ? value.abs() : value), decimal(0)).div(6);
  const candidateMae = average(candidateErrors, true); const baselineMae = average(baselineErrors, true);
  result.evaluation = { folds, candidateMae: finite(candidateMae), baselineMae: finite(baselineMae),
    candidateBias: finite(average(candidateErrors)), baselineBias: finite(average(baselineErrors)) };
  if (baselineAbsolute === 0n) return { ...result, ...unavailable('BASELINE_PERFECT') };
  // MAE candidate=C/18, baseline=B/6: compare C*10 <= B*27 exactly, before any decimal conversion.
  if (candidateAbsoluteThirds * 10n > baselineAbsolute * 27n) return { ...result, ...unavailable('NO_BASELINE_IMPROVEMENT') };
  const inputMonths = required.slice(-3);
  return { ...result, ...available, inputMonths, value: finite(mean(inputMonths.map(month => byMonth.get(month)!.count))) };
}

export function patterns(input: PatternsInput): StatisticsPayload['patterns'] {
  nonnegative(input.total, input.withoutCategory, ...(input.withoutTags === null ? [] : [input.withoutTags]));
  const proportion = (value: bigint) => {
    nonnegative(value); if (value > input.total) throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
    return input.total === 0n ? null : finite(decimal(value).div(decimal(input.total)));
  };
  const limited = <T extends { count: bigint }>(list: { items: T[]; totalGroups: bigint }, map: (row: T) => Omit<T, 'count'>) => {
    nonnegative(list.totalGroups);
    if (list.items.length > 50 || list.totalGroups < BigInt(list.items.length)) throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
    return { items: list.items.map(row => ({ ...map(row), count: row.count.toString(), ratio: proportion(row.count) ?? 0 })),
      totalGroups: list.totalGroups.toString(), truncated: list.totalGroups > BigInt(list.items.length) };
  };
  const tagsAvailability = input.tagsObserved ? available : unavailable('TAGS_NOT_OBSERVED');
  const associationsAvailability = !input.tagsObserved ? tagsAvailability : input.total < 30n ? unavailable('INSUFFICIENT_SAMPLE') : available;
  if (input.pairs.length > 1225) throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
  const seen = new Set<string>();
  const candidates = input.pairs.map(pair => {
    if (pair.tagA >= pair.tagB || seen.has(pair.tagA + pair.tagB)) throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
    seen.add(pair.tagA + pair.tagB);
    return { pair, stats: association(input.total, pair.a, pair.b, pair.count),
      lift: decimal(pair.count).mul(decimal(input.total)).div(decimal(pair.a).mul(decimal(pair.b))) };
  }).filter(({ pair }) => pair.count >= 5n && pair.count * 20n >= input.total && pair.count * input.total * 5n >= pair.a * pair.b * 6n)
    .sort((a, b) => a.pair.count !== b.pair.count ? a.pair.count > b.pair.count ? -1 : 1
      : b.lift.comparedTo(a.lift) || a.pair.tagA.localeCompare(b.pair.tagA) || a.pair.tagB.localeCompare(b.pair.tagB));
  const empty = { items: [], totalGroups: '0', truncated: false };
  return { ...available, totalTestimonials: input.total.toString(),
    categories: limited(input.categories, row => ({ id: row.id, name: row.name })),
    tags: input.tagsObserved ? limited(input.tags, row => ({ id: row.id, name: row.name })) : empty,
    tagsAvailability, associationsAvailability,
    withoutCategory: { count: input.withoutCategory.toString(), ratio: proportion(input.withoutCategory) },
    withoutTags: input.tagsObserved && input.withoutTags !== null ? { count: input.withoutTags.toString(), ratio: proportion(input.withoutTags) } : null,
    segments: limited(input.segments, row => ({ categoryKey: row.categoryKey, name: row.name, band: row.band })),
    associations: associationsAvailability.status === 'available' ? candidates.slice(0, 20).map(({ pair, stats }) => ({
      tagA: pair.tagA, tagB: pair.tagB, count: pair.count.toString(), ...stats })) : [],
  };
}

export function anomalies(at: Date, daily: DailyInput[]): StatisticsPayload['anomalies'] {
  const dayMs = 86400000; const end = Date.parse(at.toISOString().slice(0, 10)); const start = end - 89 * dayMs;
  const byDay = new Map(daily.map(row => [row.date, row]));
  if (byDay.size !== daily.length || daily.length > 118) throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
  for (const row of daily) {
    nonnegative(row.total, row.rejected, row.lowRating);
    if (row.rejected > row.total || row.lowRating > row.total || row.snapshotAt > at || row.snapshotAt.toISOString().slice(0, 10) !== row.date) {
      throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
    }
  }
  const items: StatisticsPayload['anomalies']['items'] = [];
  for (let time = start; time <= end; time += dayMs) {
    const date = new Date(time).toISOString().slice(0, 10); const current = byDay.get(date);
    for (const metric of ['low_rating_share', 'rejected_share'] as const) {
      const numerator = (row: DailyInput) => metric === 'low_rating_share' ? row.lowRating : row.rejected;
      const baseline: Decimal[] = [];
      for (let ago = 28; ago >= 1; ago -= 1) {
        const row = byDay.get(new Date(time - ago * dayMs).toISOString().slice(0, 10));
        if (row && row.total >= 30n) baseline.push(decimal(numerator(row)).div(decimal(row.total)));
      }
      const p = current && current.total > 0n ? decimal(numerator(current)).div(decimal(current.total)) : null;
      const row: typeof items[number] = { id: `${metric}:${date}`, date, metric, snapshotAt: current?.snapshotAt.toISOString() ?? null,
        provisional: date === at.toISOString().slice(0, 10), numerator: current ? numerator(current).toString() : null,
        denominator: current?.total.toString() ?? null, ratio: p ? finite(p) : null, baselineDays: baseline.length,
        median: null, mad: null, threshold: null, status: !current ? 'no_snapshot' : current.total < 30n ? 'insufficient_sample' : 'insufficient_baseline' };
      if (current && current.total >= 30n && baseline.length >= 21) {
        const middle = decimalMedian(baseline); const mad = decimalMedian(baseline.map(value => value.minus(middle).abs()));
        const threshold = middle.plus(Prisma.Decimal.max('0.05', mad.mul('1.4826').mul(3)));
        row.median = finite(middle); row.mad = finite(mad); row.threshold = finite(threshold);
        row.status = p!.gt(threshold) ? 'flagged' : 'normal';
      }
      items.push(row);
    }
  }
  const hasEvaluation = items.some(row => row.status === 'normal' || row.status === 'flagged');
  const enoughSample = items.some(row => row.denominator !== null && BigInt(row.denominator) >= 30n);
  return { ...(hasEvaluation ? available : unavailable(enoughSample ? 'INSUFFICIENT_BASELINE' : 'INSUFFICIENT_SAMPLE')),
    from: new Date(start).toISOString().slice(0, 10), to: new Date(end).toISOString().slice(0, 10), items };
}

export function calculateStatistics(input: StatisticsInputs): StatisticsPayload {
  const payload = { forecast: forecast(input.forecast), patterns: patterns(input.patterns), anomalies: anomalies(input.forecast.at, input.daily) };
  const result = statisticsPayloadSchema.safeParse(payload);
  if (!result.success) throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
  return result.data;
}
