import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../src/common/services/cache.service';
import { RedisStoreService } from '../src/common/services/redis-store.service';

const url = process.env.TEST_REDIS_URL;
if (process.env.CI && !url) throw new Error('TEST_REDIS_URL is required in CI');
const describeWithRedis = url ? describe : describe.skip;

describeWithRedis('CacheService across API replicas', () => {
  const stores: RedisStoreService[] = [];
  const make = () => {
    const store = new RedisStoreService({ get: () => ({ redis: { url } }) } as unknown as ConfigService);
    stores.push(store);
    return new CacheService(store);
  };
  afterAll(async () => { await Promise.all(stores.map(store => store.onModuleDestroy())); });

  it('shares a value, computes once and invalidates only the published tenant', async () => {
    const first = make();
    const second = make();
    const tenant = randomUUID();
    const otherTenant = randomUUID();
    const factory = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { value: 1 };
    });
    const values = await Promise.all([
      first.getOrSetPublic(tenant, 'page=1', factory),
      second.getOrSetPublic(tenant, 'page=1', factory),
    ]);
    expect(values).toEqual([{ value: 1 }, { value: 1 }]);
    expect(factory).toHaveBeenCalledTimes(1);
    await first.getOrSetPublic(otherTenant, 'page=1', async () => ({ value: 7 }));
    await first.invalidateTenantPublic(tenant);
    expect(await second.getOrSetPublic(tenant, 'page=1', async () => ({ value: 2 }))).toEqual({ value: 2 });
    expect(await second.getOrSetPublic(otherTenant, 'page=1', async () => ({ value: 8 }))).toEqual({ value: 7 });
  });

  it('does not cache values larger than 256 KiB', async () => {
    const cache = make();
    const tenant = randomUUID();
    const factory = jest.fn().mockResolvedValue('x'.repeat(300_000));
    await cache.getOrSetPublic(tenant, 'large', factory);
    await cache.getOrSetPublic(tenant, 'large', factory);
    expect(factory).toHaveBeenCalledTimes(2);
  });
});

describe('CacheService fallback', () => {
  it('reads PostgreSQL once when Redis is unavailable', async () => {
    const redis = { connection: jest.fn().mockRejectedValue(new Error('Redis unavailable')) } as unknown as RedisStoreService;
    const cache = new CacheService(redis);
    const factory = jest.fn().mockResolvedValue({ value: 3 });
    await expect(cache.getOrSetPublic(randomUUID(), 'page=1', factory)).resolves.toEqual({ value: 3 });
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
