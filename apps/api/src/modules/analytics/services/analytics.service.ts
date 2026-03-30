import { Injectable, Inject } from "@nestjs/common";
import { WEBHOOK_REPOSITORY, IWebhookRepository } from "../../webhooks/repositories/webhook.repository";
import { WEBHOOK_DISPATCHER, IWebhookDispatcher } from "../../webhooks/interfaces/webhook-dispatcher.port";
import { ANALYTICS_REPOSITORY, IAnalyticsRepository } from "../repositories/analytics-event.repository";

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

    constructor(@Inject(WEBHOOK_REPOSITORY) private readonly webhookRepo: IWebhookRepository, @Inject(WEBHOOK_DISPATCHER) private readonly dispatcher: IWebhookDispatcher, @Inject(ANALYTICS_REPOSITORY) private readonly analyticsRepo: IAnalyticsRepository) {
    }
}
