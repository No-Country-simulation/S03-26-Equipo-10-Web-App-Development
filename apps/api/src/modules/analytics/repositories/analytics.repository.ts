import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
export interface DashboardData {
  total: number;
  published: number;
  avgScore: number;
  avgRating: number;
  byStatus: Array<{ status: string; count: number }>;
}

export interface TestimonialMetrics {
  views: number;
  likes: number;
  clicks: number;
}
@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string): Promise<DashboardData> {
    const [total, published, byStatus, scores] = await Promise.all([
      this.prisma.testimonial.count({ where: { tenantId } }),
      this.prisma.testimonial.count({
        where: { tenantId, status: { code: 'published' } },
      }),
      this.prisma.testimonial.groupBy({
        by: ['statusId'],
        where: { tenantId },
        _count: true,
      }),
      this.prisma.testimonial.aggregate({
        where: { tenantId },
        _avg: { score: true, rating: true },
      }),
    ]);

    const statuses = await this.prisma.testimonialStatus.findMany();
    const statusMap = new Map(statuses.map((s: any) => [s.id, s.code]));

    return {
      total,
      published,
      avgScore: Number(scores._avg.score ?? 0),
      avgRating: Number(scores._avg.rating ?? 0),
      byStatus: byStatus.map(entry => ({
        status: statusMap.get(entry.statusId) ?? 'unknown',
        count: entry._count,
      })),
    };
  }

  async trackEvent(
    tenantId: string,
    event: { eventType: string; testimonialId?: string; metadata?: Record<string, unknown> },
  ): Promise<void> {
    const eventTypeRecord = await this.prisma.analyticsEventType.upsert({
      where: { code: event.eventType },
      update: {},
      create: { code: event.eventType },
    });

    await this.prisma.analyticsEvent.create({
      data: {
        tenantId,
        eventTypeId: eventTypeRecord.id,
        testimonialId: event.testimonialId ?? '',
        ipHash: event.metadata?.ip ? String(event.metadata.ip) : null,
      },
    });
  }

  async getTestimonialMetrics(tenantId: string, testimonialId: string): Promise<TestimonialMetrics> {
    const [views, likes, clicks] = await Promise.all([
      this.prisma.analyticsEvent.count({
        where: { tenantId, testimonialId, eventType: { code: 'view' } },
      }),
      this.prisma.analyticsEvent.count({
        where: { tenantId, testimonialId, eventType: { code: 'like' } },
      }),
      this.prisma.analyticsEvent.count({
        where: { tenantId, testimonialId, eventType: { code: 'click' } },
      }),
    ]);

    return { views, likes, clicks };
  }

  async getEngagementCounts(testimonialIds: string[]): Promise<Map<string, { views: number; clicks: number }>> {
    const result = new Map<string, { views: number; clicks: number }>();
    if (!testimonialIds.length) return result;

    for (const id of testimonialIds) {
      result.set(id, { views: 0, clicks: 0 });
    }

    const counts = await this.prisma.analyticsEvent.groupBy({
      by: ['testimonialId', 'eventTypeId'],
      where: { testimonialId: { in: testimonialIds } },
      _count: true,
    });

    const eventTypes = await this.prisma.analyticsEventType.findMany();
    const typeMap = new Map(eventTypes.map(t => [t.id, t.code]));

    for (const count of counts) {
      const code = typeMap.get(count.eventTypeId);
      const metrics = result.get(count.testimonialId);
      if (metrics) {
        if (code === 'view') metrics.views += count._count;
        if (code === 'click') metrics.clicks += count._count;
      }
    }

    return result;
  }
}
