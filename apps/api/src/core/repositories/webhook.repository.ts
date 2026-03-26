export const WEBHOOK_REPOSITORY = Symbol('IWebhookRepository');

export interface WebhookView {
  id: string;
  tenantId: string;
  url: string;
  eventCode: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDeliveryView {
  id: string;
  webhookId: string;
  outboxEventId: string | null;
  status: string;
  attempts: number;
  responseCode: number | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookWithSecret extends WebhookView {
  secret: string | null;
}

export interface IWebhookRepository {
  findByTenant(tenantId: string): Promise<WebhookView[]>;
  findById(tenantId: string, webhookId: string): Promise<WebhookWithSecret | null>;
  create(params: {
    tenantId: string;
    url: string;
    eventCode: string;
    secret?: string;
    isActive?: boolean;
  }): Promise<WebhookView>;
  update(webhookId: string, params: {
    url?: string;
    eventCode?: string;
    secret?: string;
    isActive?: boolean;
  }): Promise<WebhookView>;
  remove(webhookId: string): Promise<void>;
  findDeliveries(webhookId: string): Promise<WebhookDeliveryView[]>;
  createDelivery(params: {
    webhookId: string;
    outboxEventId?: string;
    status: string;
    attempts: number;
    responseCode?: number;
    responseBody?: string;
    errorMessage?: string;
  }): Promise<{ id: string; status: string; responseCode: number | null }>;
  findActiveByEvent(tenantId: string, eventCode: string): Promise<WebhookWithSecret[]>;
}
