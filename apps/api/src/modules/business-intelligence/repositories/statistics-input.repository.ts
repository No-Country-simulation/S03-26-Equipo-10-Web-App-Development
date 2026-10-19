import { Prisma, PrismaClient } from '@prisma/client';
import { StatisticsError, type DailyInput, type FrequencyInput, type LimitedInput, type MonthlyInput,
  type OriginInput, type PatternsInput, type StatisticsInputs, type StatisticsLease } from '../statistics.types';

type Groups<T> = T & { groups: bigint };
const limited = <T>(rows: Groups<T>[]): LimitedInput<T> => ({ items: rows.map(({ groups: _groups, ...row }) => row as T), totalGroups: rows[0]?.groups ?? 0n });

/** All analytic reads share one DW snapshot. No OLTP connection or raw testimonial text. */
export class StatisticsInputRepository {
  constructor(private readonly client: PrismaClient) {}

  read(lease: StatisticsLease): Promise<StatisticsInputs> {
    const remaining = Math.min(60000, Math.floor(lease.deadline - Date.now()));
    if (remaining <= 0) throw new StatisticsError('BI_STATISTICS_DEADLINE_EXCEEDED');
    return this.client.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL timezone = 'UTC'`;
      await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
      await tx.$queryRaw`SELECT set_config('statement_timeout', ${`${Math.min(30000, remaining)}ms`}, true),
        set_config('transaction_timeout', ${`${remaining}ms`}, true)`;
      const [header] = await tx.$queryRaw<Array<{ total: bigint; start: Date; tagsObserved: boolean; withoutCategory: bigint; withoutTags: bigint }>>`
        SELECT h.testimonial_count AS total,
          (SELECT min(snapshot_at) FROM dw.fact_tenant_snapshot WHERE tenant_id = ${lease.tenantId}::uuid
            AND snapshot_at <= ${lease.sourceSnapshotAt}) AS start,
          EXISTS(SELECT 1 FROM dw.fact_tag_snapshot WHERE tenant_id = h.tenant_id AND run_id = h.run_id) AS "tagsObserved",
          (SELECT count(*) FROM dw.fact_testimonial_snapshot f JOIN dw.dim_category c
            ON c.tenant_id = f.tenant_id AND c.category_key = f.category_key
            WHERE f.tenant_id = h.tenant_id AND f.run_id = h.run_id AND c.source_category_id IS NULL) AS "withoutCategory",
          (SELECT count(*) FROM dw.fact_testimonial_snapshot f WHERE f.tenant_id = h.tenant_id AND f.run_id = h.run_id
            AND NOT EXISTS(SELECT 1 FROM dw.bridge_testimonial_tag_snapshot b
              WHERE b.tenant_id = f.tenant_id AND b.run_id = f.run_id AND b.testimonial_id = f.testimonial_id)) AS "withoutTags"
        FROM dw.fact_tenant_snapshot h JOIN dw.statistics_history_state s ON s.tenant_id = h.tenant_id
        JOIN dw.fact_tenant_snapshot initialized ON initialized.tenant_id = s.tenant_id AND initialized.run_id = s.creations_through_run_id
        WHERE h.tenant_id = ${lease.tenantId}::uuid AND h.run_id = ${lease.sourceRunId}::uuid
          AND h.snapshot_at = ${lease.sourceSnapshotAt} AND initialized.snapshot_at >= h.snapshot_at`;
      if (!header) throw new StatisticsError('BI_STATISTICS_DATA_INVALID');
      const months = await tx.$queryRaw<MonthlyInput[]>`
        WITH calendar AS (SELECT generate_series(date_trunc('month', ${lease.sourceSnapshotAt} AT TIME ZONE 'UTC') - interval '23 months',
          date_trunc('month', ${lease.sourceSnapshotAt} AT TIME ZONE 'UTC'), interval '1 month') AS month),
        observed AS (SELECT date_trunc('month', snapshot_at AT TIME ZONE 'UTC') AS month,
          count(DISTINCT snapshot_date_key)::int AS days FROM dw.fact_tenant_snapshot
          WHERE tenant_id = ${lease.tenantId}::uuid AND snapshot_at <= ${lease.sourceSnapshotAt}
            AND snapshot_at >= ((date_trunc('month', ${lease.sourceSnapshotAt} AT TIME ZONE 'UTC') - interval '23 months') AT TIME ZONE 'UTC') GROUP BY 1),
        creations AS (SELECT date_trunc('month', created_at AT TIME ZONE 'UTC') AS month, count(*) AS amount
          FROM dw.fact_testimonial_creation WHERE tenant_id = ${lease.tenantId}::uuid
          AND first_observed_at <= ${lease.sourceSnapshotAt}
          AND created_at >= ((date_trunc('month', ${lease.sourceSnapshotAt} AT TIME ZONE 'UTC') - interval '23 months') AT TIME ZONE 'UTC') GROUP BY 1)
        SELECT to_char(c.month, 'YYYY-MM') AS month, coalesce(o.days, 0)::int AS "observedDays", coalesce(r.amount, 0)::bigint AS count
        FROM calendar c LEFT JOIN observed o ON o.month = c.month LEFT JOIN creations r ON r.month = c.month ORDER BY c.month`;
      const rawOrigins = await tx.$queryRaw<Array<{ target: string; at: Date | null; position: number; count: bigint }>>`
        WITH targets AS (SELECT generate_series(date_trunc('month', ${lease.sourceSnapshotAt} AT TIME ZONE 'UTC') - interval '6 months',
          date_trunc('month', ${lease.sourceSnapshotAt} AT TIME ZONE 'UTC') - interval '1 month', interval '1 month') AS month),
        origins AS (SELECT t.month, (SELECT min(h.snapshot_at) FROM dw.fact_tenant_snapshot h
          WHERE h.tenant_id = ${lease.tenantId}::uuid AND h.snapshot_at <= ${lease.sourceSnapshotAt}
            AND h.snapshot_at >= ((t.month - interval '1 month') AT TIME ZONE 'UTC')
            AND h.snapshot_at < (t.month AT TIME ZONE 'UTC')) AS at FROM targets t)
        SELECT to_char(o.month, 'YYYY-MM') AS target, o.at, p.position, count(c.testimonial_id) AS count
        FROM origins o CROSS JOIN (VALUES (0), (1), (2)) AS p(position)
        LEFT JOIN dw.fact_testimonial_creation c ON c.tenant_id = ${lease.tenantId}::uuid AND c.first_observed_at <= o.at
          AND c.created_at >= ((o.month + (p.position - 4) * interval '1 month') AT TIME ZONE 'UTC')
          AND c.created_at < ((o.month + (p.position - 3) * interval '1 month') AT TIME ZONE 'UTC')
        GROUP BY o.month, o.at, p.position ORDER BY o.month, p.position`;
      const originMap = new Map<string, { targetMonth: string; originAt: Date | null; counts: bigint[] }>();
      for (const row of rawOrigins) {
        const origin = originMap.get(row.target) ?? { targetMonth: row.target, originAt: row.at, counts: [] };
        origin.counts.push(row.count); originMap.set(row.target, origin);
      }
      const origins: OriginInput[] = [...originMap.values()];
      const categories = await tx.$queryRaw<Groups<FrequencyInput>[]>`
        SELECT c.category_key::text AS id, c.name, count(*) AS count, count(*) OVER () AS groups
        FROM dw.fact_testimonial_snapshot f JOIN dw.dim_category c ON c.tenant_id = f.tenant_id AND c.category_key = f.category_key
        WHERE f.tenant_id = ${lease.tenantId}::uuid AND f.run_id = ${lease.sourceRunId}::uuid
        GROUP BY c.category_key, c.name ORDER BY count(*) DESC, c.category_key LIMIT 50`;
      const tags = await tx.$queryRaw<Groups<FrequencyInput>[]>`
        SELECT b.tag_id::text AS id, t.name, count(*) AS count, count(*) OVER () AS groups
        FROM dw.bridge_testimonial_tag_snapshot b JOIN dw.dim_tag t ON t.tenant_id = b.tenant_id AND t.tag_id = b.tag_id
        WHERE b.tenant_id = ${lease.tenantId}::uuid AND b.run_id = ${lease.sourceRunId}::uuid
        GROUP BY b.tag_id, t.name ORDER BY count(*) DESC, b.tag_id LIMIT 50`;
      const segments = await tx.$queryRaw<Groups<PatternsInput['segments']['items'][number]>[]>`
        SELECT c.category_key::text AS "categoryKey", c.name,
          CASE WHEN f.rating <= 2 THEN 'low' WHEN f.rating = 3 THEN 'medium' ELSE 'high' END AS band,
          count(*) AS count, count(*) OVER () AS groups
        FROM dw.fact_testimonial_snapshot f JOIN dw.dim_category c ON c.tenant_id = f.tenant_id AND c.category_key = f.category_key
        WHERE f.tenant_id = ${lease.tenantId}::uuid AND f.run_id = ${lease.sourceRunId}::uuid
        GROUP BY c.category_key, c.name, band HAVING count(*) >= 5 ORDER BY count(*) DESC, c.category_key, band LIMIT 50`;
      const pairs = await tx.$queryRaw<PatternsInput['pairs']>`
        WITH top_tags AS MATERIALIZED (SELECT tag_id, count(*) AS n FROM dw.bridge_testimonial_tag_snapshot
          WHERE tenant_id = ${lease.tenantId}::uuid AND run_id = ${lease.sourceRunId}::uuid
          GROUP BY tag_id ORDER BY count(*) DESC, tag_id LIMIT 50)
        SELECT a.tag_id::text AS "tagA", b.tag_id::text AS "tagB", count(DISTINCT a.testimonial_id) AS count, ta.n AS a, tb.n AS b
        FROM dw.bridge_testimonial_tag_snapshot a JOIN dw.bridge_testimonial_tag_snapshot b
          ON b.tenant_id = a.tenant_id AND b.run_id = a.run_id AND b.testimonial_id = a.testimonial_id AND a.tag_id < b.tag_id
        JOIN top_tags ta ON ta.tag_id = a.tag_id JOIN top_tags tb ON tb.tag_id = b.tag_id
        WHERE a.tenant_id = ${lease.tenantId}::uuid AND a.run_id = ${lease.sourceRunId}::uuid
        GROUP BY a.tag_id, b.tag_id, ta.n, tb.n ORDER BY a.tag_id, b.tag_id LIMIT 1225`;
      const daily = await tx.$queryRaw<DailyInput[]>`
        WITH cuts AS (SELECT DISTINCT ON (snapshot_date_key) tenant_id, run_id, snapshot_at, snapshot_date_key, testimonial_count
          FROM dw.fact_tenant_snapshot WHERE tenant_id = ${lease.tenantId}::uuid AND snapshot_at <= ${lease.sourceSnapshotAt}
            AND snapshot_date_key >= (${lease.sourceSnapshotAt} AT TIME ZONE 'UTC')::date - 117
          ORDER BY snapshot_date_key, snapshot_at DESC, run_id)
        SELECT h.snapshot_date_key::text AS date, h.snapshot_at AS "snapshotAt", h.testimonial_count AS total,
          count(*) FILTER (WHERE f.status_code = 'rejected') AS rejected,
          count(*) FILTER (WHERE f.rating <= 2) AS "lowRating"
        FROM cuts h LEFT JOIN dw.fact_testimonial_snapshot f ON f.tenant_id = h.tenant_id AND f.run_id = h.run_id
        WHERE h.tenant_id = ${lease.tenantId}::uuid GROUP BY h.snapshot_date_key, h.snapshot_at, h.testimonial_count ORDER BY h.snapshot_date_key`;
      return { forecast: { at: lease.sourceSnapshotAt, historyStartedAt: header.start, months, origins },
        patterns: { total: header.total, tagsObserved: header.tagsObserved, withoutCategory: header.withoutCategory,
          withoutTags: header.tagsObserved ? header.withoutTags : null, categories: limited(categories), tags: limited(tags), segments: limited(segments), pairs }, daily };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 1000, timeout: remaining });
  }
}
