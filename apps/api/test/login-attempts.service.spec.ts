import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { RateLimitedError, UnavailableError } from '../src/common/errors/application.error';
import { RedisStoreService } from '../src/common/services/redis-store.service';
import { LoginAttemptsService } from '../src/modules/auth/services/login-attempts.service';

const url = process.env.TEST_REDIS_URL;
if (process.env.CI && !url) throw new Error('TEST_REDIS_URL is required in CI');
const describeWithRedis = url ? describe : describe.skip;

describeWithRedis('LoginAttemptsService across API replicas', () => {
  const stores: RedisStoreService[] = [];
  const make = () => {
    const store = new RedisStoreService({ get: () => ({ redis: { url } }) } as unknown as ConfigService);
    stores.push(store);
    return new LoginAttemptsService(store);
  };
  afterAll(async () => { await Promise.all(stores.map(store => store.onModuleDestroy())); });

  it('blocks across replicas after five failures and clears after success', async () => {
    const first = make();
    const second = make();
    const email = `${randomUUID()}@test.invalid`;
    for (let i = 0; i < 5; i += 1) await (i % 2 ? first : second).registerFailure(email);
    await expect(second.assertNotBlocked(email.toUpperCase())).rejects.toBeInstanceOf(RateLimitedError);
    await first.clear(email);
    await expect(second.assertNotBlocked(email)).resolves.toBeUndefined();
  });
});

describe('LoginAttemptsService failure mode', () => {
  it('fails closed when Redis cannot verify an account quota', async () => {
    const redis = { connection: jest.fn().mockRejectedValue(new Error('Redis unavailable')) } as unknown as RedisStoreService;
    const service = new LoginAttemptsService(redis);
    await expect(service.assertNotBlocked('admin@test.invalid')).rejects.toBeInstanceOf(UnavailableError);
  });
});
