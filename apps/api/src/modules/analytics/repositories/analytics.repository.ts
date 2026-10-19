import { NotFoundError } from '../../../common/errors/application.error';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
export interface DashboardData {
  observedAt: string;
  period: { kind: 'all_time'; from: string | null; to: string };
  recentEventsLimit: number;
  totalViews: number;
  totalClicks: number;
  totalPlays: number;
  events: Array<{
    id: number;
    testimonialId: string;
    testimonial: { id: string; authorName: string; excerpt: string };
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

  async isPublishedTestimonial(
    tenantId: string,
    testimonialId: string,
  ): Promise<boolean> {
    const row = await this.prisma.testimonial.findFirst({
      where: { id: testimonialId, tenantId, status: { code: 'published' } },
      select: { id: true },
    });
    return row !== null;
  }

  async getDashboard(tenantId: string): Promise<DashboardData> {
    const observedAt = new Date().toISOString();
    const recentEventsLimit = 50;
    // A single read snapshot keeps the accumulated scope and recent list consistent.
    // References are selected in the same bounded query, never fetched per row.
    return this.prisma.$transaction(
      async (tx) => {
        const where = {
          tenantId,
          testimonial: { tenantId },
          createdAt: { lte: new Date(observedAt) },
        };
        const counts = await tx.analyticsEvent.groupBy({
          by: ['eventTypeId'],
          where,
          _count: true,
        });
        const first = await tx.analyticsEvent.aggregate({
          where,
          _min: { createdAt: true },
        });
        const rawEvents = await tx.analyticsEvent.findMany({
          where,
          select: {
            id: true,
            testimonialId: true,
            createdAt: true,
            eventType: { select: { code: true } },
            testimonial: {
              select: { id: true, authorName: true, content: true },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: recentEventsLimit,
        });
        const eventTypes = await tx.analyticsEventType.findMany();
        const typeMap = new Map(eventTypes.map((t) => [t.id, t.code]));
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
          observedAt,
          recentEventsLimit,
          period: {
            kind: 'all_time' as const,
            from: first._min.createdAt?.toISOString() ?? null,
            to: observedAt,
          },
          events: rawEvents.map((e) => ({
            id: Number(e.id),
            testimonialId: e.testimonialId,
            testimonial: {
              id: e.testimonial.id,
              authorName: e.testimonial.authorName,
              excerpt: Array.from(e.testimonial.content).slice(0, 160).join(''),
            },
            eventType: e.eventType.code,
            createdAt: e.createdAt.toISOString(),
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async trackEvent(
    tenantId: string,
    event: {
      eventType: string;
      testimonialId?: string;
      source?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    const testimonial = event.testimonialId
      ? await this.prisma.testimonial.findFirst({
          where: { id: event.testimonialId, tenantId },
          select: { id: true },
        })
      : null;
    if (!testimonial)
      throw new NotFoundError('Testimonial not found for this tenant');

    const eventTypeRecord = await this.prisma.analyticsEventType.upsert({
      where: { code: event.eventType },
      update: {},
      create: { code: event.eventType },
    });

    await this.prisma.analyticsEvent.create({
      data: {
        tenantId,
        eventTypeId: eventTypeRecord.id,
        testimonialId: testimonial.id,
        source: event.source ?? 'public',
        ipHash: event.metadata?.ip
          ? createHash('sha256').update(String(event.metadata.ip)).digest('hex')
          : null,
      },
    });
  }

  async getTestimonialMetrics(
    tenantId: string,
    testimonialId: string,
  ): Promise<TestimonialMetrics> {
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

  async getEngagementCounts(
    tenantId: string,
    testimonialIds: string[],
  ): Promise<Map<string, { views: number; clicks: number }>> {
    const result = new Map<string, { views: number; clicks: number }>();
    if (!testimonialIds.length) return result;

    for (const id of testimonialIds) {
      result.set(id, { views: 0, clicks: 0 });
    }

    const counts = await this.prisma.analyticsEvent.groupBy({
      by: ['testimonialId', 'eventTypeId'],
      where: {
        tenantId,
        testimonialId: { in: testimonialIds },
        testimonial: { tenantId },
      },
      _count: true,
    });

    const eventTypes = await this.prisma.analyticsEventType.findMany();
    const typeMap = new Map(eventTypes.map((t) => [t.id, t.code]));

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
