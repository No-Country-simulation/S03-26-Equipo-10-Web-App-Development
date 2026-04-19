import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
export interface DashboardData {
  totalViews: number;
  totalClicks: number;
  totalPlays: number;
  events: Array<{
    id: number;
    testimonialId: string;
    eventType: string;
    createdAt: string;
  }>;
}

export interface TestimonialMetrics {
  views: number;
  clicks: number;
  plays: number;
}
@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(tenantId: string): Promise<DashboardData> {
    const [counts, rawEvents] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({
        by: ['eventTypeId'],
        where: { tenantId },
        _count: true,
      }),
      this.prisma.analyticsEvent.findMany({
        where: { tenantId },
        include: { eventType: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const eventTypes = await this.prisma.analyticsEventType.findMany();
    const typeMap = new Map(eventTypes.map(t => [t.id, t.code]));

    let totalViews = 0;
    let totalClicks = 0;
    let totalPlays = 0;

    for (const count of counts) {
      const code = typeMap.get(count.eventTypeId);
      if (code === 'view') totalViews += count._count;
      if (code === 'click') totalClicks += count._count;
      if (code === 'play') totalPlays += count._count;
    }

    return {
      totalViews,
      totalClicks,
      totalPlays,
      events: rawEvents.map(e => ({
        id: Number(e.id),
        testimonialId: e.testimonialId,
        eventType: e.eventType.code,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  }

  async trackEvent(
    tenantId: string,
    event: { eventType: string; testimonialId?: string; source?: string; metadata?: Record<string, unknown> },
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
        source: event.source ?? 'public',
        ipHash: event.metadata?.ip
          ? createHash('sha256').update(String(event.metadata.ip)).digest('hex')
          : null,
      },
    });
  }

  async getTestimonialMetrics(tenantId: string, testimonialId: string): Promise<TestimonialMetrics> {
    const [views, clicks, plays] = await Promise.all([
      this.prisma.analyticsEvent.count({
        where: { tenantId, testimonialId, eventType: { code: 'view' } },
      }),
      this.prisma.analyticsEvent.count({
        where: { tenantId, testimonialId, eventType: { code: 'click' } },
      }),
      this.prisma.analyticsEvent.count({
        where: { tenantId, testimonialId, eventType: { code: 'play' } },
      }),
    ]);

    return { views, clicks, plays };
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
