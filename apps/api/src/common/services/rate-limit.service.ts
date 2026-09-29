import { Injectable } from '@nestjs/common';
import { RateLimitedError } from '../errors/application.error';

interface RateLimitBucket {
  count: number;
  resetAtMs: number;
}

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();

  assertWithinLimit(
    key: string,
    limit: number,
    windowSeconds: number,
    message = 'Too many requests',
  ): void {
    const now = Date.now();
    const existing = this.buckets.get(key);
    const windowMs = windowSeconds * 1000;

    if (!existing || existing.resetAtMs <= now) {
      this.buckets.set(key, { count: 1, resetAtMs: now + windowMs });
      return;
    }

    if (existing.count >= limit) {
      throw new RateLimitedError(message, 'TOO_MANY_REQUESTS');
    }

    existing.count += 1;
    this.buckets.set(key, existing);
  }
}
