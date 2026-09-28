import { Injectable, NotFoundException } from '@nestjs/common';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { TenantsService } from '../../tenants';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly analyticsRepo: AnalyticsRepository,
    private readonly tenantsService: TenantsService,
  ) {}

  async trackEvent(
    tenantId: string,
    event: { eventType: string; testimonialId?: string; source?: string; metadata?: Record<string, unknown> },
    ip: string,
  ) {
    await this.analyticsRepo.trackEvent(tenantId, {
      ...event,
      metadata: { ...event.metadata, ip },
    });
    return { tracked: true };
  }

  async trackPublicEventBySlug(
    slug: string,
    event: { eventType: string; testimonialId: string; source?: string },
    ip: string,
  ) {
    const tenant = await this.tenantsService.getTenantByPublicSlug(slug);
    const published = await this.analyticsRepo.isPublishedTestimonial(tenant.id, event.testimonialId);
    if (!published) {
      throw new NotFoundException('Published testimonial not found for this tenant');
    }
    return this.trackEvent(tenant.id, {
      eventType: event.eventType,
      testimonialId: event.testimonialId,
      source: event.source ?? 'public-browser',
    }, ip);
  }

  getDashboard(tenantId: string) {
    return this.analyticsRepo.getDashboard(tenantId);
  }

  getTestimonialMetrics(tenantId: string, testimonialId: string) {
    return this.analyticsRepo.getTestimonialMetrics(tenantId, testimonialId);
  }

  getEngagementCounts(testimonialIds: string[]) {
    return this.analyticsRepo.getEngagementCounts(testimonialIds);
  }
}
