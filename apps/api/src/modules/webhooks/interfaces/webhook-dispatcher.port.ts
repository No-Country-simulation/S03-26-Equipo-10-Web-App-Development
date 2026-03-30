export const WEBHOOK_DISPATCHER = Symbol('IWebhookDispatcher');

export interface IWebhookDispatcher {
  dispatch(
    webhookId: string,
    url: string,
    secret: string | null,
    payload: Record<string, unknown>,
    outboxEventId?: string,
  ): Promise<void>;
}
