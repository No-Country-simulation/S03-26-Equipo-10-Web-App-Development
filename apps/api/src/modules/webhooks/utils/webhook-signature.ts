import { createHmac, timingSafeEqual } from 'node:crypto';

export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

export function signWebhookBody(body: Buffer, timestamp: number, secret: string): string {
  return createHmac('sha256', secret)
    .update(String(timestamp)).update('.').update(body).digest('hex');
}

/** Helper for consumers and tests; deduplicate business effects by event ID separately. */
export function verifyWebhookSignature(
  body: Buffer,
  header: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const parts = header.split(',').map(part => part.trim());
  const timestampPart = parts.find(part => /^t=\d+$/.test(part));
  if (!timestampPart) return false;
  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > WEBHOOK_SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }
  const expected = Buffer.from(signWebhookBody(body, timestamp, secret), 'hex');
  return parts.some(part => {
    if (!/^v1=[0-9a-f]{64}$/.test(part)) return false;
    return timingSafeEqual(expected, Buffer.from(part.slice(3), 'hex'));
  });
}
