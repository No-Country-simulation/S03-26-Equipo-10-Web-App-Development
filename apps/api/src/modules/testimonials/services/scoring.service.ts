import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { TestimonialRepository } from '../repositories/testimonial.repository';
import { AnalyticsService } from '../../analytics';

@Injectable()
export class ScoringService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ScoringService.name);
  private timer?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    private readonly testimonialRepo: TestimonialRepository,
    private readonly analyticsService: AnalyticsService,
  ) {}

  onApplicationBootstrap() {
    this.logger.log('Iniciando worker de cálculo de scores (cada hora)');
    // Run immediately on boot
    this.processScores().catch(() => this.logger.error('Initial scoring failed'));
    // Run every hour
    this.timer = setInterval(() => {
      this.processScores().catch(() => this.logger.error('Scheduled scoring failed'));
    }, 60 * 60 * 1000);
  }

  onApplicationShutdown() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async processScores() {
    if (this.isProcessing) {
      this.logger.warn('Skipping score calculation — previous run still in progress');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      let updatedCount = 0;
      for (const tenantId of await this.testimonialRepo.findScoringTenantIds()) {
        const testimonials = await this.testimonialRepo.findPublishedForScoring(tenantId);
        if (!testimonials.length) continue;
        const engagementMap = await this.analyticsService.getEngagementCounts(tenantId, testimonials.map(t => t.id));
        const now = Date.now();
        const updates = testimonials.map(t => {
          const metrics = engagementMap.get(t.id) ?? { views: 0, clicks: 0 };
          const daysSincePublished = t.publishedAt ? Math.max(0, (now - t.publishedAt.getTime()) / 86400000) : 0;
          // Preserve the existing rating + engagement - age formula and four-decimal rounding.
          const rawScore = t.rating * 10 + (metrics.views * 0.1 + metrics.clicks * 0.5) - daysSincePublished * 0.05;
          return { id: t.id, score: Math.max(0, Math.round(rawScore * 10000) / 10000) };
        });
        await this.testimonialRepo.updateScores(tenantId, updates);
        updatedCount += updates.length;
      }
      this.logger.log({ durationMs: Date.now() - startTime, updatedCount }, 'Score calculation completed');
    } finally {
      this.isProcessing = false;
    }
  }
}
