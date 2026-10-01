import { hasDeliveryBudget, isRetryableDelivery, retryDelayMs } from '../src/modules/webhooks/services/delivery-retry-policy';

describe('delivery retry policy', () => {
  it.each([null, 408, 429, 500, 503])('reintenta %s', status => {
    expect(isRetryableDelivery(status)).toBe(true);
  });

  it.each([200, 201, 301, 400, 401, 404, 422, 600])('termina %s', status => {
    expect(isRetryableDelivery(status)).toBe(false);
  });

  it('usa full jitter dentro del techo exponencial', () => {
    expect(retryDelayMs(1, () => 0)).toBe(0);
    expect(retryDelayMs(2, () => 0.5)).toBe(1000);
    expect(retryDelayMs(20, () => 0.999999)).toBeLessThan(60 * 60 * 1000);
  });

  it('agota el presupuesto a diez intentos o 72 horas', () => {
    const now = new Date('2026-09-30T12:00:00Z');
    expect(hasDeliveryBudget(9, new Date(now.getTime() - 71 * 60 * 60 * 1000), now)).toBe(true);
    expect(hasDeliveryBudget(10, now, now)).toBe(false);
    expect(hasDeliveryBudget(1, new Date(now.getTime() - 72 * 60 * 60 * 1000), now)).toBe(false);
  });
});
