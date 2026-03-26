import { Inject, Injectable } from '@nestjs/common';
import { ANALYTICS_REPOSITORY, IAnalyticsRepository } from '../../core/repositories/analytics-event.repository';

@Injectable()
export class GetTestimonialMetricsUseCase {
  constructor(
    @Inject(ANALYTICS_REPOSITORY) private readonly analyticsRepo: IAnalyticsRepository,
  ) {}

  async execute(tenantId: string, testimonialId: string) {
    return this.analyticsRepo.getTestimonialMetrics(tenantId, testimonialId);
  }
}
