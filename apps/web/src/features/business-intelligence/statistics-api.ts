import { z } from 'zod';
import {
  sessionRequest,
  type SessionFetch,
} from '@/lib/api/validated-response';
// Zod 3 browser contract; intentionally independent of the API Zod 4 runtime.
const count = z.string().regex(/^(0|[1-9]\d*)$/);
const number = z
  .number()
  .finite()
  .min(-Number.MAX_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER);
const ratio = number.min(0).max(1);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const at = new Date(value + 'T00:00:00.000Z');
    return (
      Number.isFinite(at.getTime()) && at.toISOString().slice(0, 10) === value
    );
  });
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const instant = z.string().datetime({ precision: 3 });
const reason = z.enum([
  'NOT_LOADED',
  'INSUFFICIENT_HISTORY',
  'INSUFFICIENT_COVERAGE',
  'MISSING_EVALUATION_ORIGIN',
  'BASELINE_PERFECT',
  'NO_BASELINE_IMPROVEMENT',
  'INSUFFICIENT_SAMPLE',
  'INSUFFICIENT_BASELINE',
  'TAGS_NOT_OBSERVED',
  'STALE_PUBLICATION',
  'TARGET_OUTDATED',
]);
const availability = {
  status: z.enum(['available', 'unavailable']),
  reason: reason.nullable(),
};
const frequency = z
  .object({ id: z.string(), name: z.string(), count, ratio })
  .strict();
const limited = <T extends z.ZodTypeAny>(item: T) =>
  z
    .object({
      items: z.array(item).max(50),
      totalGroups: count,
      truncated: z.boolean(),
    })
    .strict();
const coverageCount = z
  .object({ count, ratio: ratio.nullable() })
  .strict()
  .nullable();
const sectionsSchema = z
  .object({
    forecast: z
      .object({
        ...availability,
        targetMonth: month,
        method: z.literal('moving_average_3_constant'),
        horizon: z.literal(2),
        value: number.min(0).nullable(),
        inputMonths: z.array(month).max(3),
        history: z
          .array(
            z
              .object({
                month,
                count: count.nullable(),
                observedDays: z.number().int().min(0).max(31),
                calendarDays: z.number().int().min(28).max(31),
                coverage: ratio,
                partial: z.boolean(),
              })
              .strict(),
          )
          .max(24),
        evaluation: z
          .object({
            folds: z
              .array(
                z
                  .object({
                    targetMonth: month,
                    originAt: instant,
                    actual: count,
                    candidate: number.min(0),
                    baseline: number.min(0),
                  })
                  .strict(),
              )
              .length(6),
            candidateMae: number.min(0),
            baselineMae: number.min(0),
            candidateBias: number,
            baselineBias: number,
          })
          .strict()
          .nullable(),
      })
      .strict(),
    patterns: z
      .object({
        ...availability,
        totalTestimonials: count.nullable(),
        categories: limited(frequency),
        tags: limited(frequency),
        tagsAvailability: z.object(availability).strict(),
        associationsAvailability: z.object(availability).strict(),
        withoutCategory: coverageCount,
        withoutTags: coverageCount,
        segments: limited(
          z
            .object({
              categoryKey: z.string(),
              name: z.string(),
              band: z.enum(['low', 'medium', 'high']),
              count,
              ratio,
            })
            .strict(),
        ),
        associations: z
          .array(
            z
              .object({
                tagA: z.string().uuid(),
                tagB: z.string().uuid(),
                count,
                support: ratio,
                confidenceAB: ratio,
                confidenceBA: ratio,
                lift: number.min(0),
              })
              .strict(),
          )
          .max(20),
      })
      .strict(),
    anomalies: z
      .object({
        ...availability,
        from: day,
        to: day,
        items: z
          .array(
            z
              .object({
                id: z.string(),
                date: day,
                metric: z.enum(['rejected_share', 'low_rating_share']),
                snapshotAt: instant.nullable(),
                provisional: z.boolean(),
                numerator: count.nullable(),
                denominator: count.nullable(),
                ratio: ratio.nullable(),
                baselineDays: z.number().int().min(0).max(28),
                median: ratio.nullable(),
                mad: ratio.nullable(),
                threshold: number.min(0).nullable(),
                status: z.enum([
                  'no_snapshot',
                  'insufficient_sample',
                  'insufficient_baseline',
                  'normal',
                  'flagged',
                ]),
              })
              .strict(),
          )
          .max(180),
      })
      .strict(),
  })
  .strict();

export const statisticsSchema = sectionsSchema
  .extend({
    observedAt: instant,
    timezone: z.literal('UTC'),
    algorithmVersion: z.literal('stats_v1'),
    publicationStatus: z.enum(['not_loaded', 'pending', 'current', 'outdated']),
    publication: z
      .object({
        sourceRunId: z.string().uuid(),
        sourceSnapshotAt: instant,
        generatedAt: instant,
      })
      .strict()
      .nullable(),
    coverage: z
      .object({
        historyStartedAt: instant.nullable(),
        tagHistoryStartedAt: instant.nullable(),
        creationsScope: z.literal('observed_only'),
      })
      .strict(),
    freshness: z
      .object({
        status: z.enum(['not_loaded', 'fresh', 'stale']),
        dataAgeSeconds: number.min(0).nullable(),
        staleAfterSeconds: number.int().min(0),
        frequencyHours: z.union([z.literal(1), z.literal(6), z.literal(24)]),
        delayToleranceMinutes: z.union([
          z.literal(30),
          z.literal(60),
          z.literal(120),
        ]),
        schedulePaused: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const invalid = () =>
      ctx.addIssue({ code: 'custom', message: 'Invalid statistics response' });
    for (const section of [
      data.forecast,
      data.patterns,
      data.patterns.tagsAvailability,
      data.patterns.associationsAvailability,
      data.anomalies,
    ]) {
      if ((section.status === 'available') !== (section.reason === null))
        invalid();
    }
    const published = data.publication !== null;
    if (
      published !== ['current', 'outdated'].includes(data.publicationStatus) ||
      published !== (data.patterns.totalTestimonials !== null) ||
      data.anomalies.items.length !== (published ? 180 : 0) ||
      (data.forecast.status === 'available') !==
        (data.forecast.value !== null) ||
      (data.forecast.status === 'available' &&
        (!data.forecast.evaluation || data.forecast.inputMonths.length !== 3))
    )
      invalid();
    if (
      !published &&
      (data.forecast.reason !== 'NOT_LOADED' ||
        data.forecast.history.length ||
        data.forecast.evaluation ||
        data.forecast.inputMonths.length ||
        data.patterns.reason !== 'NOT_LOADED' ||
        data.patterns.categories.items.length ||
        data.patterns.tags.items.length ||
        data.patterns.segments.items.length ||
        data.patterns.associations.length ||
        data.patterns.withoutCategory !== null ||
        data.patterns.withoutTags !== null ||
        data.anomalies.reason !== 'NOT_LOADED' ||
        data.freshness.status !== 'not_loaded' ||
        data.freshness.dataAgeSeconds !== null)
    )
      invalid();
    const seen = new Set<string>();
    for (const row of data.anomalies.items) {
      if (
        row.id !== `${row.metric}:${row.date}` ||
        seen.has(row.id) ||
        row.date < data.anomalies.from ||
        row.date > data.anomalies.to ||
        (row.status === 'no_snapshot') !== (row.snapshotAt === null) ||
        (row.snapshotAt === null &&
          (row.numerator !== null ||
            row.denominator !== null ||
            row.ratio !== null))
      )
        invalid();
      seen.add(row.id);
    }
    if (
      data.publication &&
      data.anomalies.to !== data.publication.sourceSnapshotAt.slice(0, 10)
    )
      invalid();
  });
export type BiStatistics = z.infer<typeof statisticsSchema>;
export function getBiStatistics(fetchApi: SessionFetch, signal?: AbortSignal) {
  return sessionRequest(
    fetchApi,
    '/bi/statistics',
    statisticsSchema,
    signal ? { signal } : undefined,
  );
}
