import { Injectable } from '@nestjs/common';
import { DashboardQueryDto, dateRange } from '../dtos/dashboard-query.dto';
import { DashboardRepository } from '../repositories/dashboard.repository';

import { OperationsReadRepository } from '../repositories/operations-read.repository';
import { freshnessPolicy } from './operations-policy';

@Injectable()
export class DashboardService {
  constructor(private readonly repository: DashboardRepository, private readonly operations: OperationsReadRepository) {}
  async get(tenantId: string, query: DashboardQueryDto) {
    const range = dateRange(query);
    const [dashboard, settings] = await Promise.all([this.repository.dashboard(tenantId, range), this.operations.settings(tenantId)]);
    return { ...dashboard, freshness: { ...dashboard.freshness, ...freshnessPolicy(dashboard.freshness.dataAgeSeconds, settings) } };
  }
}
