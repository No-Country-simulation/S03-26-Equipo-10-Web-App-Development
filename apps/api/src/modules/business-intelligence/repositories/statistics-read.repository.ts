import {
  ApplicationError,
  UnavailableError,
} from '../../../common/errors/application.error';
import {
  statisticsPayloadSchema,
  STATISTICS_VERSION,
  type StatisticsPayload,
} from '../statistics.types';
import type { OperationsReads } from './operations-read.repository';

export interface StatisticsReadState {
  now: Date;
  latestRunId: string | null;
  historyStartedAt: Date | null;
  tagHistoryStartedAt: Date | null;
  publication: {
    sourceRunId: string;
    sourceSnapshotAt: Date;
    generatedAt: Date;
  } | null;
  payload: StatisticsPayload | null;
}
export class StatisticsReadRepository {
  constructor(private readonly connection: OperationsReads) {}
  async read(tenantId: string): Promise<StatisticsReadState> {
    try {
      return await this.connection.read(async (tx) => {
        const [clock] = await tx.$queryRaw<
          Array<{ now: Date; history: Date | null; tags: Date | null }>
        >`
          SELECT statement_timestamp() AS now,
            (SELECT min(snapshot_at) FROM dw.fact_tenant_snapshot WHERE tenant_id = ${tenantId}::uuid) AS history,
            (SELECT min(h.snapshot_at) FROM dw.fact_tag_snapshot t JOIN dw.fact_tenant_snapshot h
              ON h.tenant_id = t.tenant_id AND h.run_id = t.run_id WHERE t.tenant_id = ${tenantId}::uuid) AS tags`;
        const [latest] = await tx.$queryRaw<
          Array<{ id: string; at: Date }>
        >`SELECT run_id AS id, snapshot_at AS at
          FROM dw.fact_tenant_snapshot WHERE tenant_id = ${tenantId}::uuid ORDER BY snapshot_at DESC, run_id LIMIT 1`;
        const [published] = await tx.$queryRaw<
          Array<{
            id: string;
            at: Date;
            generated: Date;
            headerAt: Date;
            payload: unknown;
          }>
        >`
          SELECT p.source_run_id AS id, p.source_snapshot_at AS at, p.generated_at AS generated, h.snapshot_at AS "headerAt", p.payload
          FROM dw.statistics_current c JOIN dw.statistics_publication p
            ON p.tenant_id = c.tenant_id AND p.source_run_id = c.source_run_id AND p.algorithm_version = c.algorithm_version
          JOIN dw.fact_tenant_snapshot h ON h.tenant_id = p.tenant_id AND h.run_id = p.source_run_id
          WHERE c.tenant_id = ${tenantId}::uuid AND c.algorithm_version = ${STATISTICS_VERSION}`;
        if (!clock) throw new Error('Invalid clock');
        let payload: StatisticsPayload | null = null;
        if (published) {
          const parsed = statisticsPayloadSchema.safeParse(published.payload);
          const target = new Date(published.at);
          target.setUTCDate(1);
          target.setUTCMonth(target.getUTCMonth() + 1);
          if (
            !parsed.success ||
            !latest ||
            published.at > latest.at ||
            published.at.getTime() !== published.headerAt.getTime() ||
            parsed.data.anomalies.to !==
              published.at.toISOString().slice(0, 10) ||
            parsed.data.forecast.targetMonth !==
              target.toISOString().slice(0, 7)
          )
            throw new Error('Invalid publication');
          payload = parsed.data;
        }
        return {
          now: clock.now,
          latestRunId: latest?.id ?? null,
          historyStartedAt: clock.history,
          tagHistoryStartedAt: clock.tags,
          publication: published
            ? {
                sourceRunId: published.id,
                sourceSnapshotAt: published.at,
                generatedAt: published.generated,
              }
            : null,
          payload,
        };
      });
    } catch (error) {
      if (error instanceof ApplicationError && error.code === 'BI_DISABLED')
        throw error;
      throw new UnavailableError(
        'Statistical analytics is unavailable',
        'BI_STATISTICS_UNAVAILABLE',
      );
    }
  }
}
