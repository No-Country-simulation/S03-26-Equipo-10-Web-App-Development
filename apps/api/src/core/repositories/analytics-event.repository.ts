export const ANALYTICS_REPOSITORY = Symbol('IAnalyticsRepository');

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
}

export interface IAnalyticsRepository {
  getDashboard(tenantId: string): Promise<DashboardData>;
  trackEvent(tenantId: string, event: { eventType: string; testimonialId?: string; metadata?: Record<string, unknown> }): Promise<void>;
  getTestimonialMetrics(tenantId: string, testimonialId: string): Promise<TestimonialMetrics>;
}
