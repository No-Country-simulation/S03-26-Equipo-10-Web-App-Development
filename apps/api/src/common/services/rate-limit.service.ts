import { Injectable } from '@nestjs/common';
import { RateLimitedError } from '../errors/application.error';
import { RedisStoreService } from './redis-store.service';

const TAKE_QUOTA = `
for i = 1, #KEYS do
  if tonumber(redis.call('GET', KEYS[i]) or '0') >= tonumber(ARGV[1]) then return i end
end
for i = 1, #KEYS do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('PEXPIRE', KEYS[i], ARGV[2]) end
end
return 0`;

@Injectable()
export class RateLimitService {
  constructor(private readonly redis: RedisStoreService) {}

  /** Comprueba todas las dimensiones y las consume en un único comando atómico. */
  async assertWithinLimit(keys: string[], limit: number, windowSeconds: number,
    message = 'Too many requests'): Promise<void> {
    const client = await this.redis.connection();
    const exceeded = Number(await client.eval(TAKE_QUOTA, {
      keys, arguments: [String(limit), String(windowSeconds * 1000)],
    }));
    if (exceeded > 0) throw new RateLimitedError(message, 'TOO_MANY_REQUESTS');
  }
}
