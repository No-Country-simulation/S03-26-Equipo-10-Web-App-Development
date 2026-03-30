import { Injectable, Inject } from "@nestjs/common";
import { WebhookRepository } from "../../webhooks/repositories/webhook.repository";
import { HttpWebhookDispatcher } from "../../webhooks/services/http-webhook-dispatcher";
import { AnalyticsRepository } from '../repositories/analytics.repository';

@Injectable()
export class AnalyticsService {
    async dispatchOutboxEvent(event: {
            id: string;
            tenantId: string;
            eventType: string;
            payload: unknown;
            attempts: number;
          }) {
        const configured = await this.webhookRepo.findActiveByEvent(
          event.tenantId,
          event.eventType,
        );

        for (const webhook of configured) {
          await this.dispatcher.dispatch(
            webhook.id,
            webhook.url,
            webhook.secret,
            {
              eventType: event.eventType,
              tenantId: event.tenantId,
              payload: event.payload,
              outboxEventId: event.id,
              sentAt: new Date().toISOString(),
            },
            event.id,
          );
        }
    }

    async trackEvent(tenantId: string, event: { eventType: string; testimonialId?: string; metadata?: Record<string, unknown> }, ip: string) {
        await this.analyticsRepo.trackEvent(tenantId, {
          ...event,
          metadata: { ...event.metadata, ip },
        });
        return { tracked: true };
    }

    async getDashboard(tenantId: string) {
        return this.analyticsRepo.getDashboard(tenantId);
    }

    async getTestimonialMetrics(tenantId: string, testimonialId: string) {
        return this.analyticsRepo.getTestimonialMetrics(tenantId, testimonialId);
    }

    constructor(private readonly webhookRepo: WebhookRepository, private readonly dispatcher: HttpWebhookDispatcher, private readonly analyticsRepo: AnalyticsRepository) {
    }
}
