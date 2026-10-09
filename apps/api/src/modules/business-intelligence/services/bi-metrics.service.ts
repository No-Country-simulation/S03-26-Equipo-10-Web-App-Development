import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Registry } from '@prometheus-io/client';
import { BiConnection } from '../repositories/bi-connection';

@Injectable()
export class BiMetricsService {
  constructor(private readonly connection: BiConnection) {}
  async render(): Promise<string> {
    // Explicit operator inventory, never a tenant-facing dashboard query. No tenant IDs in labels.
    const snapshot = await this.connection.read(async tx => {
      const states = await tx.$queryRaw<Array<{ status: string; count: bigint; seconds: string; categories: string; testimonials: string; events: string }>>`
        SELECT status, count(*) AS count, coalesce(sum(extract(epoch FROM finished_at - started_at)), 0)::text AS seconds,
          sum(source_category_count)::text AS categories, sum(source_testimonial_count)::text AS testimonials,
          sum(source_event_count)::text AS events FROM etl.runs GROUP BY status`;
      const [freshness] = await tx.$queryRaw<Array<{ age: number | null; unloaded: bigint; stale: bigint }>>`
        SELECT max(extract(epoch FROM statement_timestamp() - r.source_snapshot_at))::float8 AS age,
          count(*) FILTER (WHERE r.id IS NULL) AS unloaded,
          count(*) FILTER (WHERE coalesce(c.schedule_enabled, true) AND
            r.source_snapshot_at < statement_timestamp() - make_interval(secs =>
              coalesce(c.frequency_hours, 1) * 3600 + coalesce(c.delay_tolerance_minutes, 60) * 60)) AS stale
        FROM etl.tenant_load_state s LEFT JOIN etl.runs r
          ON r.tenant_id = s.tenant_id AND r.id = s.last_published_run_id AND r.status = 'succeeded'
        LEFT JOIN etl.tenant_settings c ON c.tenant_id = s.tenant_id`;
      const [lease] = await tx.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM etl.runs WHERE error_code = 'BI_LEASE_LOST'`;
      const buckets = await tx.$queryRaw<Array<{ le: number; count: bigint }>>`
        SELECT b.le::float8 AS le, count(r.id) AS count FROM (VALUES (1), (5), (15), (30), (60), (120), (300), (360)) b(le)
        LEFT JOIN etl.runs r ON r.finished_at IS NOT NULL AND extract(epoch FROM r.finished_at - r.started_at) <= b.le
        GROUP BY b.le ORDER BY b.le`;
      return { states, freshness, lease, buckets };
    });
    const registry = new Registry();
    const runs = new Counter({ name: 'tms_bi_etl_runs_total', help: 'Terminal ETL attempts retained in the warehouse ledger', labelNames: ['status'], registers: [registry] });
    const active = new Gauge({ name: 'tms_bi_etl_running', help: 'Attempts still marked running (including expired leases)', registers: [registry] });
    const rows = new Counter({ name: 'tms_bi_etl_source_rows_total', help: 'Completed extraction rows retained across attempts; retries are counted', labelNames: ['kind'], registers: [registry] });
    let seconds = 0; let completed = 0;
    for (const row of snapshot.states) {
      if (row.status === 'running') active.set(Number(row.count));
      else { runs.inc({ status: row.status }, Number(row.count)); seconds += Number(row.seconds); completed += Number(row.count); }
      rows.inc({ kind: 'categories' }, Number(row.categories)); rows.inc({ kind: 'testimonials' }, Number(row.testimonials)); rows.inc({ kind: 'events' }, Number(row.events));
    }
    new Counter({ name: 'tms_bi_etl_lease_lost_total', help: 'Lease losses retained in the ledger', registers: [registry] }).inc(Number(snapshot.lease?.count ?? 0n));
    new Gauge({ name: 'tms_bi_oldest_snapshot_age_seconds', help: 'Age of oldest current published tenant snapshot', registers: [registry] }).set(Math.max(0, snapshot.freshness?.age ?? 0));
    new Gauge({ name: 'tms_bi_tenants_not_loaded', help: 'Known ETL tenants without a publication', registers: [registry] }).set(Number(snapshot.freshness?.unloaded ?? 0n));
    new Gauge({ name: 'tms_bi_tenants_stale', help: 'Known unpaused ETL tenants with a snapshot older than frequency plus tolerance', registers: [registry] }).set(Number(snapshot.freshness?.stale ?? 0n));
    // Durable histogram reconstructed from bounded aggregates, without materializing all ledger rows.
    const histogram = ['# HELP tms_bi_etl_duration_seconds Completed attempt wall time from the durable ledger',
      '# TYPE tms_bi_etl_duration_seconds histogram', ...snapshot.buckets.map(b => `tms_bi_etl_duration_seconds_bucket{le="${b.le}"} ${b.count}`),
      `tms_bi_etl_duration_seconds_bucket{le="+Inf"} ${completed}`, `tms_bi_etl_duration_seconds_sum ${seconds}`, `tms_bi_etl_duration_seconds_count ${completed}`].join('\n');
    return `${await registry.metrics()}\n${histogram}\n`;
  }
}
