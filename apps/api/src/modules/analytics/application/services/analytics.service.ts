import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../../prisma/prisma.service';
import { TrackAnalyticsEventDto } from '../dto/track-analytics-event.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async trackEvent(tenantId: string, dto: TrackAnalyticsEventDto, ipAddress: string) {
    const testimonial = await this.prisma.testimonial.findFirst({
      where: {
        id: dto.testimonialId,
        tenantId,
      },
    });

    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }

    const type = await this.prisma.analyticsEventType.findUnique({
      where: { code: dto.eventType },
    });

    if (!type) {
      throw new NotFoundException('Analytics event type not found');
    }

    const event = await this.prisma.analyticsEvent.create({
      data: {
        tenantId,
        testimonialId: dto.testimonialId,
        eventTypeId: type.id,
        source: dto.source ?? 'public',
        ipHash: this.hashIp(ipAddress),
      },
    });

    return {
      id: event.id.toString(),
      testimonialId: dto.testimonialId,
      eventType: dto.eventType,
      source: event.source,
      createdAt: event.createdAt,
    };
  }

  async dashboard(tenantId: string) {
    const [totalTestimonials, publishedStatus, totalEvents, recentEvents] = await Promise.all([
      this.prisma.testimonial.count({ where: { tenantId } }),
      this.prisma.testimonialStatus.findUnique({ where: { code: 'published' } }),
      this.prisma.analyticsEvent.count({ where: { tenantId } }),
      this.prisma.analyticsEvent.findMany({
        where: { tenantId },
        include: {
          eventType: true,
          testimonial: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    const publishedCount = publishedStatus
      ? await this.prisma.testimonial.count({ where: { tenantId, statusId: publishedStatus.id } })
      : 0;

    const byType = recentEvents.reduce<Record<string, number>>((acc, event) => {
      acc[event.eventType.code] = (acc[event.eventType.code] ?? 0) + 1;
      return acc;
    }, {});

    const topTestimonials = await this.prisma.testimonial.findMany({
      where: { tenantId },
      orderBy: { score: 'desc' },
      take: 5,
      include: { status: true },
    });

    return {
      totals: {
        testimonials: totalTestimonials,
        published: publishedCount,
        events: totalEvents,
      },
      eventsByType: byType,
      topTestimonials: topTestimonials.map(item => ({
        id: item.id,
        authorName: item.authorName,
        score: Number(item.score),
        status: item.status.code,
      })),
    };
  }

  async testimonialMetrics(tenantId: string, testimonialId: string) {
    const testimonial = await this.prisma.testimonial.findFirst({ where: { id: testimonialId, tenantId } });
    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }

    const events = await this.prisma.analyticsEvent.findMany({
      where: { tenantId, testimonialId },
      include: { eventType: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const counts = events.reduce<Record<string, number>>((acc, event) => {
      acc[event.eventType.code] = (acc[event.eventType.code] ?? 0) + 1;
      return acc;
    }, {});

    return {
      testimonialId,
      counts,
      total: events.length,
      recent: events.slice(0, 20).map(event => ({
        id: event.id.toString(),
        eventType: event.eventType.code,
        source: event.source,
        createdAt: event.createdAt,
      })),
    };
  }

  private hashIp(ipAddress: string): string {
    return createHash('sha256').update(ipAddress).digest('hex');
  }
}

