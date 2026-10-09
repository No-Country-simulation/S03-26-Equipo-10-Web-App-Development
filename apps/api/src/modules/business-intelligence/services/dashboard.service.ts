import { Injectable } from '@nestjs/common';
import { DashboardQueryDto, dateRange } from '../dtos/dashboard-query.dto';
import { DashboardRepository } from '../repositories/dashboard.repository';

@Injectable()
export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}
  get(tenantId: string, query: DashboardQueryDto) { return this.repository.dashboard(tenantId, dateRange(query)); }
}
