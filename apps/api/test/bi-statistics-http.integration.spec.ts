import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  BiStatisticsController,
  BiStatisticsGuard,
} from '../src/modules/business-intelligence/controllers/bi-statistics.controller';
import { BiPrivateMiddleware } from '../src/modules/business-intelligence/guards/bi-private.middleware';
import { StatisticsReadService } from '../src/modules/business-intelligence/services/statistics-read.service';
import { CredentialRepository } from '../src/common/repositories/credential.repository';
import { RateLimitService } from '../src/common/services/rate-limit.service';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';
import {
  RateLimitedError,
  UnavailableError,
} from '../src/common/errors/application.error';

describe('private statistics HTTP contract', () => {
  let app: INestApplication;
  let guard: BiStatisticsGuard;
  let tokens: Map<string, string>;
  const tenant = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const secret = 'synthetic-test-key-with-at-least-32-characters';
  const service = { get: jest.fn() };
  const quota = { assertWithinLimit: jest.fn() };
  const env = {
    bi: process.env.BI_ENABLED,
    statistics: process.env.BI_STATISTICS_ENABLED,
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [BiStatisticsController],
      providers: [
        JwtService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => ({ jwt: { secret } }) },
        },
        { provide: StatisticsReadService, useValue: service },
        { provide: RateLimitService, useValue: quota },
        {
          provide: CredentialRepository,
          useValue: {
            findActiveUser: async (id: string) => ({
              userId: id,
              tenantId: id === 'other' ? other : tenant,
              roles: [
                id === 'none' ? 'viewer' : id === 'editor' ? 'editor' : 'admin',
              ],
            }),
          },
        },
      ],
    })
      .overrideGuard(BiStatisticsGuard)
      .useValue({ canActivate: () => guard.canActivate() })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(new BiPrivateMiddleware().use);
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
    tokens = new Map(
      ['admin', 'editor', 'other', 'none'].map((sub) => [
        sub,
        app
          .get(JwtService)
          .sign(
            { sub, tenantId: sub === 'other' ? other : tenant },
            { secret },
          ),
      ]),
    );
  });
  beforeEach(() => {
    process.env.BI_ENABLED = 'true';
    process.env.BI_STATISTICS_ENABLED = 'true';
    guard = new BiStatisticsGuard();
    service.get
      .mockReset()
      .mockImplementation(async (tenantId) => ({ tenantId }));
    quota.assertWithinLimit.mockReset().mockResolvedValue(undefined);
  });
  afterAll(async () => {
    await app?.close();
    if (env.bi === undefined) delete process.env.BI_ENABLED;
    else process.env.BI_ENABLED = env.bi;
    if (env.statistics === undefined) delete process.env.BI_STATISTICS_ENABLED;
    else process.env.BI_STATISTICS_ENABLED = env.statistics;
  });
  const get = (role: string, query = '') =>
    request(app.getHttpServer())
      .get('/api/v1/bi/statistics' + query)
      .auth(tokens.get(role)!, { type: 'bearer' });
  it('authenticates before flags and keeps authentication failures private', async () => {
    process.env.BI_STATISTICS_ENABLED = 'false';
    guard = new BiStatisticsGuard();
    const anonymous = await request(app.getHttpServer())
      .get('/api/v1/bi/statistics')
      .expect(401);
    const forbidden = await get('none').expect(403);
    expect(anonymous.headers['cache-control']).toBe('private, no-store');
    expect(forbidden.headers['cache-control']).toBe('private, no-store');
    expect(service.get).not.toHaveBeenCalled();
  });
  it('accepts admin/editor and derives tenant only from the validated session', async () => {
    for (const role of ['admin', 'editor', 'other']) {
      const response = await get(role).expect(200);
      expect(response.body).toMatchObject({
        success: true,
        data: { tenantId: role === 'other' ? other : tenant },
      });
      expect(response.headers['cache-control']).toBe('private, no-store');
    }
    expect(quota.assertWithinLimit).toHaveBeenCalledWith(
      expect.any(Array),
      120,
      60,
      expect.any(String),
    );
  });
  it.each([
    '?tenantId=foreign',
    '?from=2025-01-01',
    '?to=',
    '?page=1',
    '?unknown=1&unknown=2',
  ])('rejects any query %s before reading', async (query) => {
    const response = await get('editor', query).expect(400);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(service.get).not.toHaveBeenCalled();
  });
  it('disables optional reads without invoking the service or quota', async () => {
    process.env.BI_STATISTICS_ENABLED = 'false';
    guard = new BiStatisticsGuard();
    expect((await get('admin').expect(503)).body.code).toBe(
      'BI_STATISTICS_DISABLED',
    );
    process.env.BI_ENABLED = 'false';
    guard = new BiStatisticsGuard();
    expect((await get('admin').expect(503)).body.code).toBe('BI_DISABLED');
    expect(service.get).not.toHaveBeenCalled();
    expect(quota.assertWithinLimit).not.toHaveBeenCalled();
  });
  it('returns safe unavailable and quota Problem Details without results or SQL', async () => {
    service.get.mockRejectedValueOnce(
      new UnavailableError(
        'Statistical analytics is unavailable',
        'BI_STATISTICS_UNAVAILABLE',
      ),
    );
    const response = await get('editor').expect(503);
    expect(response.body.code).toBe('BI_STATISTICS_UNAVAILABLE');
    expect(response.body).not.toHaveProperty('data');
    quota.assertWithinLimit.mockRejectedValueOnce(
      new RateLimitedError('Request quota exceeded'),
    );
    const limited = await get('editor').expect(429);
    expect(limited.headers['cache-control']).toBe('private, no-store');
  });
});
