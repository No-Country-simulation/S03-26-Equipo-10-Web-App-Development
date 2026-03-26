export const OUTBOX_PORT = Symbol('IOutboxPort');

export interface OutboxEvent {
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

export interface IOutboxPort {
  emit(event: OutboxEvent): Promise<void>;
}
