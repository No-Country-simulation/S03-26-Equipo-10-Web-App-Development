import {
  ApplicationError,
  UnavailableError,
} from '../../../common/errors/application.error';
import { Inject, Injectable } from '@nestjs/common';
import { StatisticsReadRepository } from '../repositories/statistics-read.repository';
import { OperationsReadRepository } from '../repositories/operations-read.repository';
import {
  STATISTICS_VERSION,
  unavailable,
  type StatisticsPayload,
} from '../statistics.types';
import { freshnessPolicy } from './operations-policy';

@Injectable()
export class StatisticsReadService {
  constructor(
    @Inject(StatisticsReadRepository)
    private readonly repository: Pick<StatisticsReadRepository, 'read'>,
    @Inject(OperationsReadRepository)
    private readonly operations: Pick<OperationsReadRepository, 'settings'>,
  ) {}
  async get(tenantId: string) {
    const [state, settings] = await Promise.all([
      this.repository.read(tenantId),
      this.operations.settings(tenantId).catch((error: unknown) => {
        if (error instanceof ApplicationError && error.code === 'BI_DISABLED')
          throw error;
        throw new UnavailableError(
          'Statistical analytics is unavailable',
          'BI_STATISTICS_UNAVAILABLE',
        );
      }),
    ]);
    const age = state.publication
      ? Math.max(
          0,
          Math.floor(
            (state.now.getTime() -
              state.publication.sourceSnapshotAt.getTime()) /
              1000,
          ),
        )
      : null;
    const freshness = {
      ...freshnessPolicy(age, settings),
      dataAgeSeconds: age,
    };
    const publicationStatus = !state.latestRunId
      ? ('not_loaded' as const)
      : !state.publication
        ? ('pending' as const)
        : state.latestRunId === state.publication.sourceRunId
          ? ('current' as const)
          : ('outdated' as const);
    const next = new Date(state.now);
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + 1);
    const targetMonth = next.toISOString().slice(0, 7);
    const emptyList = { items: [], totalGroups: '0', truncated: false };
    const payload = state.payload;
    type Forecast = Omit<StatisticsPayload['forecast'], 'reason'> & {
      reason:
        | StatisticsPayload['forecast']['reason']
        | 'STALE_PUBLICATION'
        | 'TARGET_OUTDATED';
    };
    let forecast: Forecast = payload?.forecast ?? {
      ...unavailable('NOT_LOADED'),
      targetMonth,
      method: 'moving_average_3_constant',
      horizon: 2,
      value: null,
      inputMonths: [],
      history: [],
      evaluation: null,
    };
    const invalidForecast =
      forecast.targetMonth !== targetMonth
        ? 'TARGET_OUTDATED'
        : payload &&
            (publicationStatus === 'outdated' || freshness.status === 'stale')
          ? 'STALE_PUBLICATION'
          : null;
    if (invalidForecast)
      forecast = {
        ...forecast,
        status: 'unavailable',
        reason: invalidForecast,
        value: null,
      };
    return {
      observedAt: state.now.toISOString(),
      timezone: 'UTC' as const,
      algorithmVersion: STATISTICS_VERSION,
      publicationStatus,
      publication: state.publication
        ? {
            sourceRunId: state.publication.sourceRunId,
            sourceSnapshotAt: state.publication.sourceSnapshotAt.toISOString(),
            generatedAt: state.publication.generatedAt.toISOString(),
          }
        : null,
      coverage: {
        historyStartedAt: state.historyStartedAt?.toISOString() ?? null,
        tagHistoryStartedAt: state.tagHistoryStartedAt?.toISOString() ?? null,
        creationsScope: 'observed_only' as const,
      },
      freshness,
      forecast,
      patterns: payload?.patterns ?? {
        ...unavailable('NOT_LOADED'),
        totalTestimonials: null,
        categories: emptyList,
        tags: emptyList,
        tagsAvailability: unavailable('NOT_LOADED'),
        associationsAvailability: unavailable('NOT_LOADED'),
        withoutCategory: null,
        withoutTags: null,
        segments: emptyList,
        associations: [],
      },
      anomalies: payload?.anomalies ?? {
        ...unavailable('NOT_LOADED'),
        from: new Date(
          Date.parse(state.now.toISOString().slice(0, 10)) - 89 * 86400000,
        )
          .toISOString()
          .slice(0, 10),
        to: state.now.toISOString().slice(0, 10),
        items: [],
      },
    };
  }
}
