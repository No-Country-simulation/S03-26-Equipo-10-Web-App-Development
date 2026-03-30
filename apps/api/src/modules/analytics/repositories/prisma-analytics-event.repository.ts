import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { IAnalyticsRepository, DashboardData, TestimonialMetrics } from './analytics-event.repository';

@Injectable()
export class PrismaAnalyticsRepository implements IAnalyticsRepository {
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
    const [views, likes] = await Promise.all([
      this.prisma.analyticsEvent.count({
        where: { tenantId, testimonialId, eventType: { code: 'view' } },
      }),
      this.prisma.analyticsEvent.count({
        where: { tenantId, testimonialId, eventType: { code: 'like' } },
      }),
    ]);

    return { views, likes };
  }
}
