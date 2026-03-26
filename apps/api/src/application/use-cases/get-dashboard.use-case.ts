import { Inject, Injectable } from '@nestjs/common';
import { ANALYTICS_REPOSITORY, IAnalyticsRepository } from '../../core/repositories/analytics-event.repository';

@Injectable()
export class GetDashboardUseCase {
  constructor(
    @Inject(ANALYTICS_REPOSITORY) private readonly analyticsRepo: IAnalyticsRepository,
  ) {}

  async execute(tenantId: string) {
    return this.analyticsRepo.getDashboard(tenantId);
  }
}
