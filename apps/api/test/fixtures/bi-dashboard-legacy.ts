/** Benchmark-only baseline from commit 085d95b; imports/class name adapted, query behavior preserved. */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DateRange } from '../../src/modules/business-intelligence/dtos/dashboard-query.dto';
import { BiConnection } from '../../src/modules/business-intelligence/repositories/bi-connection';

export function safeCount(count: bigint): number {
  if (count < 0n || count > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('BI_COUNT_OUT_OF_RANGE');
  return Number(count);
}
export function ctr(views: bigint, clicks: bigint): number | null {
  if (views === 0n) return null;
  const ratio = new Prisma.Decimal(clicks.toString()).div(views.toString()).times(100).toDecimalPlaces(2).toNumber();
  if (!Number.isFinite(ratio)) throw new Error('BI_COUNT_OUT_OF_RANGE');
  return ratio;
}
type Inventory = { total: bigint; rating: Prisma.Decimal | null };
type Engagement = { date: string; views: bigint; clicks: bigint; plays: bigint };

@Injectable()
export class LegacyDashboardRepository {
  constructor(private readonly connection: BiConnection) {}
  dashboard(tenantId: string, range: DateRange) {
    return this.connection.read(async tx => {
      const [latest] = await tx.$queryRaw<Array<{ id: string; at: Date; finished: Date }>>`
        SELECT r.id, r.source_snapshot_at AS at, r.finished_at AS finished
        FROM etl.tenant_load_state s JOIN etl.runs r ON r.tenant_id = s.tenant_id AND r.id = s.last_published_run_id
        WHERE s.tenant_id = ${tenantId}::uuid AND r.status = 'succeeded'`;
      const runId = latest?.id ?? null;
      const [inventory] = await tx.$queryRaw<Inventory[]>`SELECT count(*) AS total, avg(rating) AS rating
        FROM dw.fact_testimonial_snapshot WHERE tenant_id = ${tenantId}::uuid AND run_id = ${runId}::uuid`;
      const states = await tx.$queryRaw<Array<{ code: string; count: bigint }>>`SELECT status_code AS code, count(*) AS count
        FROM dw.fact_testimonial_snapshot WHERE tenant_id = ${tenantId}::uuid AND run_id = ${runId}::uuid
        GROUP BY status_code ORDER BY status_code`;
      const categories = await tx.$queryRaw<Array<{ key: bigint; name: string; count: bigint; rating: Prisma.Decimal | null }>>`
        SELECT c.category_key AS key, c.name, count(*) AS count, avg(f.rating) AS rating FROM dw.fact_testimonial_snapshot f
        JOIN dw.dim_category c ON c.tenant_id = f.tenant_id AND c.category_key = f.category_key
        WHERE f.tenant_id = ${tenantId}::uuid AND f.run_id = ${runId}::uuid
        GROUP BY c.category_key, c.name ORDER BY count DESC, c.category_key`;
      const observed = await tx.$queryRaw<Array<Inventory & { date: string; at: Date }>>`
        WITH cuts AS (SELECT DISTINCT ON ((source_snapshot_at AT TIME ZONE 'UTC')::date)
          id, tenant_id, source_snapshot_at FROM etl.runs WHERE tenant_id = ${tenantId}::uuid AND status = 'succeeded'
          AND source_snapshot_at >= ${range.from}::date AND source_snapshot_at < ${range.to}::date + interval '1 day'
          ORDER BY (source_snapshot_at AT TIME ZONE 'UTC')::date, source_snapshot_at DESC, id)
        SELECT (c.source_snapshot_at AT TIME ZONE 'UTC')::date::text AS date, c.source_snapshot_at AS at,
          count(f.testimonial_id) AS total, avg(f.rating) AS rating FROM cuts c
        LEFT JOIN dw.fact_testimonial_snapshot f ON f.tenant_id = c.tenant_id AND f.run_id = c.id
        WHERE c.tenant_id = ${tenantId}::uuid GROUP BY c.id, c.source_snapshot_at ORDER BY c.source_snapshot_at`;
      const rawEvents = await tx.$queryRaw<Array<{ date: string; views: string; clicks: string; plays: string }>>`
        SELECT f.date_key::text AS date,
          coalesce(sum(f.event_count) FILTER (WHERE k.code = 'view'), 0)::text AS views,
          coalesce(sum(f.event_count) FILTER (WHERE k.code = 'click'), 0)::text AS clicks,
          coalesce(sum(f.event_count) FILTER (WHERE k.code = 'play'), 0)::text AS plays
        FROM dw.fact_engagement_daily f JOIN dw.dim_event_type k ON k.event_type_key = f.event_type_key
        WHERE f.tenant_id = ${tenantId}::uuid AND f.date_key BETWEEN ${range.from}::date AND ${range.to}::date
        GROUP BY f.date_key ORDER BY f.date_key`;
      const events: Engagement[] = rawEvents.map(row => ({ date: row.date, views: BigInt(row.views), clicks: BigInt(row.clicks), plays: BigInt(row.plays) }));
      const [history] = await tx.$queryRaw<Array<{ snapshots: Date | null; events: string | null; now: Date }>>`
        SELECT (SELECT min(source_snapshot_at) FROM etl.runs WHERE tenant_id = ${tenantId}::uuid AND status = 'succeeded') AS snapshots,
          (SELECT min(date_key)::text FROM dw.fact_engagement_daily WHERE tenant_id = ${tenantId}::uuid) AS events,
          statement_timestamp() AS now`;
      const days: string[] = [];
      for (let at = Date.parse(range.from); at <= Date.parse(range.to); at += 86400000) days.push(new Date(at).toISOString().slice(0, 10));
      const cutsByDay = new Map(observed.map(row => [row.date, row]));
      const eventsByDay = new Map(events.map(row => [row.date, row]));
      const totals = events.reduce((sum, row) => ({ views: sum.views + row.views, clicks: sum.clicks + row.clicks, plays: sum.plays + row.plays }),
        { views: 0n, clicks: 0n, plays: 0n });
      const age = latest ? Math.max(0, Math.floor(((history?.now ?? new Date()).getTime() - latest.at.getTime()) / 1000)) : null;
      return {
        range, summary: { totalTestimonials: safeCount(inventory?.total ?? 0n), averageRating: inventory?.rating?.toNumber() ?? null,
          statuses: states.map(row => ({ code: row.code, count: safeCount(row.count) })),
          views: totals.views.toString(), clicks: totals.clicks.toString(), plays: totals.plays.toString(), ctr: ctr(totals.views, totals.clicks) },
        testimonialSeries: days.map(date => { const cut = cutsByDay.get(date); return { date, snapshotAt: cut?.at.toISOString() ?? null,
          total: cut ? safeCount(cut.total) : null, averageRating: cut?.rating?.toNumber() ?? null }; }),
        engagementSeries: days.map(date => { const row = eventsByDay.get(date) ?? { views: 0n, clicks: 0n, plays: 0n };
          return { date, views: row.views.toString(), clicks: row.clicks.toString(), plays: row.plays.toString(), ctr: ctr(row.views, row.clicks) }; }),
        categories: categories.map(row => ({ categoryKey: row.key.toString(), name: row.name, count: safeCount(row.count), averageRating: row.rating?.toNumber() ?? null })),
        freshness: { status: age === null ? 'not_loaded' as const : age > 7200 ? 'stale' as const : 'fresh' as const,
          sourceSnapshotAt: latest?.at.toISOString() ?? null, lastPublishedAt: latest?.finished.toISOString() ?? null,
          historyStartedAt: history?.snapshots?.toISOString() ?? null, engagementHistoryStartedAt: history?.events ?? null, dataAgeSeconds: age },
      };
    });
  }
}
