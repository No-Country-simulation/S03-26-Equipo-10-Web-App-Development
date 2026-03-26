import { Inject, Injectable } from '@nestjs/common';
import { ANALYTICS_REPOSITORY, IAnalyticsRepository } from '../../core/repositories/analytics-event.repository';

@Injectable()
export class TrackEventUseCase {
  constructor(
    @Inject(ANALYTICS_REPOSITORY) private readonly analyticsRepo: IAnalyticsRepository,
  ) {}

  async execute(
    tenantId: string,
    event: { eventType: string; testimonialId?: string; metadata?: Record<string, unknown> },
    ip?: string,
  ) {
    await this.analyticsRepo.trackEvent(tenantId, {
      ...event,
      metadata: { ...event.metadata, ip },
    });
    return { tracked: true };
  }
}
