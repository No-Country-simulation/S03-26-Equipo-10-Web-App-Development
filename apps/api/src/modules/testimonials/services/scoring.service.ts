import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { TestimonialRepository } from '../repositories/testimonial.repository';
import { AnalyticsRepository } from '../../analytics/repositories/analytics.repository';

@Injectable()
export class ScoringService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(ScoringService.name);
  private timer?: NodeJS.Timeout;
  private isProcessing = false;

  constructor(
    private readonly testimonialRepo: TestimonialRepository,
    private readonly analyticsRepo: AnalyticsRepository,
  ) {}

  onApplicationBootstrap() {
    this.logger.log('Iniciando worker de cálculo de scores (cada hora)');
    // Run immediately on boot
    this.processScores().catch(err => this.logger.error({ err }, 'Initial scoring failed'));
    // Run every hour
    this.timer = setInterval(() => {
      this.processScores().catch(err => this.logger.error({ err }, 'Scheduled scoring failed'));
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
      this.logger.log('Fetching published testimonials for scoring');
      const testimonials = await this.testimonialRepo.findAllPublishedForScoring();
      
      if (testimonials.length === 0) {
        this.logger.log('No published testimonials found — skipping scoring run');
        return;
      }

      this.logger.log({ count: testimonials.length }, 'Calculating testimonial scores');
      const testimonialIds = testimonials.map(t => t.id);
      
      // Get all engagement metrics in one query (O(1) database roundtrip)
      const engagementMap = await this.analyticsRepo.getEngagementCounts(testimonialIds);
      
      const now = new Date().getTime();
      const updates: { id: string; score: number }[] = [];

      for (const t of testimonials) {
        const metrics = engagementMap.get(t.id) || { views: 0, clicks: 0 };
        
        let daysSincePublished = 0;
        if (t.publishedAt) {
          const msSincePublished = now - t.publishedAt.getTime();
          daysSincePublished = Math.max(0, msSincePublished / (1000 * 60 * 60 * 24));
        }

        // BR-SCORE-001: Score calculation logic
        const baseScore = t.rating * 10;
        const engagementScore = (metrics.views * 0.1) + (metrics.clicks * 0.5);
        const decayPenalty = daysSincePublished * 0.05;
        
        const rawScore = baseScore + engagementScore - decayPenalty;
        // Keep score positive and round to 4 decimals to match Postgres Decimal(10,4)
        const finalScore = Math.max(0, Math.round(rawScore * 10000) / 10000);

        updates.push({ id: t.id, score: finalScore });
      }

      await this.testimonialRepo.updateScores(updates);
      
      const durationMs = Date.now() - startTime;
      this.logger.log({ durationMs, updatedCount: updates.length }, 'Score calculation completed');
    } finally {
      this.isProcessing = false;
    }
  }
}
