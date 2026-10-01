export const MAX_DELIVERY_ATTEMPTS = 10;
export const DELIVERY_BUDGET_MS = 72 * 60 * 60 * 1000;
export const DELIVERY_LEASE_MS = 30_000;

/** Cada intento admite una sola llamada HTTP. 408, 429, 5xx y red reintentan. */
export function isRetryableDelivery(status: number | null): boolean {
  return status === null || status === 408 || status === 429 || (status >= 500 && status <= 599);
}

/** Exponential backoff con full jitter y tope de una hora. */
export function retryDelayMs(attempt: number, random = Math.random): number {
  const ceiling = Math.min(60 * 60 * 1000, 1000 * 2 ** Math.max(0, attempt - 1));
  return Math.floor(random() * ceiling);
}

export function hasDeliveryBudget(attempts: number, startedAt: Date, now = new Date()): boolean {
  return attempts < MAX_DELIVERY_ATTEMPTS && now.getTime() - startedAt.getTime() < DELIVERY_BUDGET_MS;
}
