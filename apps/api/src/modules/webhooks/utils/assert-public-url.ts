import { BadRequestException } from '@nestjs/common';

/**
 * Validates that a webhook URL does not target private/internal networks (SSRF prevention).
 * Blocks: localhost, 127.x.x.x, 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x, [::1], 0.0.0.0
 */
export function assertPublicUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestException('Invalid webhook URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BadRequestException('Webhook URL must use HTTP or HTTPS');
  }

  const hostname = parsed.hostname.toLowerCase();

  const blockedPatterns = [
    /^localhost$/,
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/,
    /^192\.168\.\d{1,3}\.\d{1,3}$/,
    /^169\.254\.\d{1,3}\.\d{1,3}$/,
    /^0\.0\.0\.0$/,
    /^\[?::1\]?$/,
    /^$/,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      throw new BadRequestException(
        'Webhook URL must not target private or internal networks',
      );
    }
  }
}
