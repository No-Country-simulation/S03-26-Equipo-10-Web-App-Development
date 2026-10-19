import { z } from 'zod';

export const STATISTICS_VERSION = 'stats_v1';
export type StatisticsCode = 'BI_STATISTICS_FAILED' | 'BI_STATISTICS_DEADLINE_EXCEEDED' | 'BI_STATISTICS_LEASE_LOST'
  | 'BI_STATISTICS_DATA_INVALID' | 'BI_STATISTICS_COUNT_OUT_OF_RANGE';
export class StatisticsError extends Error {
  constructor(readonly code: StatisticsCode) { super(code); }
}
const count = z.string().regex(/^(0|[1-9]\d*)$/);
const number = z.number().finite().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const ratio = number.min(0).max(1);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const at = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(at.getTime()) && at.toISOString().slice(0, 10) === value;
});
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const instant = z.string().datetime({ precision: 3 });
const reason = z.enum(['NOT_LOADED', 'INSUFFICIENT_HISTORY', 'INSUFFICIENT_COVERAGE', 'MISSING_EVALUATION_ORIGIN',
  'BASELINE_PERFECT', 'NO_BASELINE_IMPROVEMENT', 'INSUFFICIENT_SAMPLE', 'INSUFFICIENT_BASELINE', 'TAGS_NOT_OBSERVED']);
const availability = { status: z.enum(['available', 'unavailable']), reason: reason.nullable() };
const frequency = z.object({ id: z.string(), name: z.string(), count, ratio }).strict();
const limited = <T extends z.ZodTypeAny>(item: T) => z.object({ items: z.array(item).max(50), totalGroups: count, truncated: z.boolean() }).strict();
const coverageCount = z.object({ count, ratio: ratio.nullable() }).strict().nullable();
export const statisticsPayloadSchema = z.object({
  forecast: z.object({ ...availability, targetMonth: month, method: z.literal('moving_average_3_constant'), horizon: z.literal(2),
    value: number.min(0).nullable(), inputMonths: z.array(month).max(3),
    history: z.array(z.object({ month, count: count.nullable(), observedDays: z.number().int().min(0).max(31),
      calendarDays: z.number().int().min(28).max(31), coverage: ratio, partial: z.boolean() }).strict()).max(24),
    evaluation: z.object({ folds: z.array(z.object({ targetMonth: month, originAt: instant, actual: count,
      candidate: number.min(0), baseline: number.min(0) }).strict()).length(6),
      candidateMae: number.min(0), baselineMae: number.min(0), candidateBias: number, baselineBias: number }).strict().nullable(),
  }).strict(),
  patterns: z.object({ ...availability, totalTestimonials: count, categories: limited(frequency), tags: limited(frequency),
    tagsAvailability: z.object(availability).strict(), associationsAvailability: z.object(availability).strict(),
    withoutCategory: coverageCount, withoutTags: coverageCount,
    segments: limited(z.object({ categoryKey: z.string(), name: z.string(), band: z.enum(['low', 'medium', 'high']), count, ratio }).strict()),
    associations: z.array(z.object({ tagA: z.string().uuid(), tagB: z.string().uuid(), count, support: ratio,
      confidenceAB: ratio, confidenceBA: ratio, lift: number.min(0) }).strict()).max(20),
  }).strict(),
  anomalies: z.object({ ...availability, from: day, to: day, items: z.array(z.object({ id: z.string(), date: day,
    metric: z.enum(['rejected_share', 'low_rating_share']), snapshotAt: instant.nullable(), provisional: z.boolean(),
    numerator: count.nullable(), denominator: count.nullable(), ratio: ratio.nullable(), baselineDays: z.number().int().min(0).max(28),
    median: ratio.nullable(), mad: ratio.nullable(), threshold: number.min(0).nullable(),
    status: z.enum(['no_snapshot', 'insufficient_sample', 'insufficient_baseline', 'normal', 'flagged']) }).strict()).max(180),
  }).strict(),
}).strict().superRefine((data, ctx) => {
  for (const section of [data.forecast, data.patterns, data.patterns.tagsAvailability, data.patterns.associationsAvailability, data.anomalies]) {
    if ((section.status === 'available') !== (section.reason === null)) ctx.addIssue({ code: 'custom', message: 'Invalid availability' });
  }
  const signalIds = new Set<string>();
  for (const row of data.anomalies.items) {
    const evaluated = row.status === 'normal' || row.status === 'flagged';
    if (row.id !== `${row.metric}:${row.date}` || signalIds.has(row.id) || row.date < data.anomalies.from || row.date > data.anomalies.to
      || (row.status === 'no_snapshot') !== (row.snapshotAt === null)
      || (row.snapshotAt === null && (row.numerator !== null || row.denominator !== null || row.ratio !== null))
      || (row.snapshotAt !== null && (row.numerator === null || row.denominator === null))
      || (evaluated && (row.baselineDays < 21 || row.median === null || row.mad === null || row.threshold === null))
      || (!evaluated && (row.median !== null || row.mad !== null || row.threshold !== null))) {
      ctx.addIssue({ code: 'custom', message: 'Invalid anomaly state' });
    }
    signalIds.add(row.id);
  }
  if (data.anomalies.items.length !== 180) ctx.addIssue({ code: 'custom', message: 'Incomplete daily calendar' });
  if ((data.forecast.status === 'available') !== (data.forecast.value !== null)
    || (data.forecast.status === 'available' && (data.forecast.inputMonths.length !== 3 || !data.forecast.evaluation))) {
    ctx.addIssue({ code: 'custom', message: 'Invalid forecast state' });
  }
});
export type StatisticsPayload = z.infer<typeof statisticsPayloadSchema>;
export type Availability = { status: 'available'; reason: null } | { status: 'unavailable'; reason: z.infer<typeof reason> };
export const available: Availability = { status: 'available', reason: null };
export const unavailable = (value: z.infer<typeof reason>): Availability => ({ status: 'unavailable', reason: value });
export interface MonthlyInput { month: string; count: bigint; observedDays: number }
export interface OriginInput { targetMonth: string; originAt: Date | null; counts: readonly bigint[] }
export interface ForecastInput { at: Date; historyStartedAt: Date; months: MonthlyInput[]; origins: OriginInput[] }
export interface FrequencyInput { id: string; name: string; count: bigint }
export interface LimitedInput<T> { items: T[]; totalGroups: bigint }
export interface PatternsInput {
  total: bigint; tagsObserved: boolean; withoutCategory: bigint; withoutTags: bigint | null;
  categories: LimitedInput<FrequencyInput>; tags: LimitedInput<FrequencyInput>;
  segments: LimitedInput<{ categoryKey: string; name: string; band: 'low' | 'medium' | 'high'; count: bigint }>;
  pairs: Array<{ tagA: string; tagB: string; count: bigint; a: bigint; b: bigint }>;
}
export interface DailyInput { date: string; snapshotAt: Date; total: bigint; rejected: bigint; lowRating: bigint }
export interface StatisticsInputs { forecast: ForecastInput; patterns: PatternsInput; daily: DailyInput[] }
export interface StatisticsLease { tenantId: string; sourceRunId: string; sourceSnapshotAt: Date; token: string; deadline: number }
