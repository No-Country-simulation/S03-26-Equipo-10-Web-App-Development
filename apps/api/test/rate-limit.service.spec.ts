import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { RateLimitedError } from '../src/common/errors/application.error';
import { RateLimitService } from '../src/common/services/rate-limit.service';
import { RedisStoreService } from '../src/common/services/redis-store.service';

const url = process.env.TEST_REDIS_URL;
if (process.env.CI && !url) throw new Error('TEST_REDIS_URL is required in CI');
const describeWithRedis = url ? describe : describe.skip;

describeWithRedis('RateLimitService across API replicas', () => {
  const stores: RedisStoreService[] = [];
  const make = () => {
    const store = new RedisStoreService({ get: () => ({ redis: { url } }) } as unknown as ConfigService);
    stores.push(store);
    return new RateLimitService(store);
  };

  afterAll(async () => { await Promise.all(stores.map(store => store.onModuleDestroy())); });

  it('shares atomic IP, tenant and key quotas between two processes', async () => {
    const first = make();
    const second = make();
    const prefix = `test-quota:${randomUUID()}`;
    const keys = [`${prefix}:ip`, `${prefix}:tenant`, `${prefix}:key`];
    const calls = await Promise.allSettled(Array.from({ length: 12 }, (_, i) =>
      (i % 2 ? first : second).assertWithinLimit(keys, 5, 60)));
    expect(calls.filter(result => result.status === 'fulfilled')).toHaveLength(5);
    expect(calls.filter(result => result.status === 'rejected' && result.reason instanceof RateLimitedError)).toHaveLength(7);
    const client = await stores[0]!.connection();
    expect(await client.pTTL(keys[0]!)).toBeGreaterThan(0);
    await client.del(keys);
  });
});
