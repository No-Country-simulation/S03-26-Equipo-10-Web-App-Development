import { randomUUID } from 'node:crypto';
import { Controller, Get, Module, Post, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { RateLimit } from '../src/common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../src/common/guards/rate-limit.guard';
import { RateLimitService } from '../src/common/services/rate-limit.service';
import { RedisStoreService } from '../src/common/services/redis-store.service';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';

const url = process.env.TEST_REDIS_URL;
if (process.env.CI && !url) throw new Error('TEST_REDIS_URL is required in CI');
const describeWithRedis = url ? describe : describe.skip;
const path = `quota-${randomUUID()}`;

@Controller(path)
@UseGuards(RateLimitGuard)
class QuotaController {
  @Post()
  @RateLimit({ limit: 2, windowSeconds: 60, scope: 'ip' })
  write() { return { accepted: true }; }

  @Get()
  @RateLimit({ limit: 2, windowSeconds: 60, scope: 'ip' })
  read() { return { accepted: true }; }
}

@Module({
  controllers: [QuotaController],
  providers: [RedisStoreService, RateLimitService, RateLimitGuard, {
    provide: ConfigService,
    useValue: { get: () => ({ redis: { url } }) },
  }],
})
class QuotaModule {}

describeWithRedis('HTTP quota shared by two Nest API instances', () => {
  const apps: INestApplication[] = [];
  beforeAll(async () => {
    for (let i = 0; i < 2; i += 1) {
      const module = await Test.createTestingModule({ imports: [QuotaModule] }).compile();
      const app = module.createNestApplication();
      app.useGlobalFilters(new ApiExceptionFilter());
      await app.init();
      apps.push(app);
    }
  });
  afterAll(async () => { await Promise.all(apps.map(app => app.close())); });

  it('rejects the third mutation after alternating requests between replicas', async () => {
    expect((await request(apps[0]!.getHttpServer()).post(`/${path}`)).status).toBe(201);
    expect((await request(apps[1]!.getHttpServer()).post(`/${path}`)).status).toBe(201);
    expect((await request(apps[0]!.getHttpServer()).post(`/${path}`)).status).toBe(429);
  });
});
