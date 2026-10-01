import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RateLimitedError, UnavailableError } from '../../../common/errors/application.error';
import { RedisStoreService } from '../../../common/services/redis-store.service';

const RECORD_FAILURE = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return count`;

@Injectable()
export class LoginAttemptsService {
  private readonly maxAttempts = 5;
  private readonly blockWindowMs = 15 * 60 * 1000;

  constructor(private readonly redis: RedisStoreService) {}

  private key(email: string): string {
    const digest = createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
    return `login-attempts:v1:${digest}`;
  }

  async assertNotBlocked(email: string): Promise<void> {
    try {
      const count = await (await this.redis.connection()).get(this.key(email));
      if (Number(count ?? 0) >= this.maxAttempts) {
        throw new RateLimitedError('Account temporarily locked');
      }
    } catch (error) {
      if (error instanceof RateLimitedError) throw error;
      throw new UnavailableError('Login quota unavailable');
    }
  }

  async registerFailure(email: string): Promise<void> {
    try {
      await (await this.redis.connection()).eval(RECORD_FAILURE, {
        keys: [this.key(email)], arguments: [String(this.blockWindowMs)],
      });
    } catch {
      throw new UnavailableError('Login quota unavailable');
    }
  }

  async clear(email: string): Promise<void> {
    try {
      await (await this.redis.connection()).del(this.key(email));
    } catch {
      throw new UnavailableError('Login quota unavailable');
    }
  }
}
