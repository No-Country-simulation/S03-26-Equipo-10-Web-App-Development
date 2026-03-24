import { SetMetadata } from '@nestjs/common';

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
  scope?: 'ip' | 'ip-api-key';
}

export const RATE_LIMIT_KEY = 'rate-limit';
export const RateLimit = (config: RateLimitConfig) =>
  SetMetadata(RATE_LIMIT_KEY, config);
