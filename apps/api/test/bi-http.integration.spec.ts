import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ZodValidationPipe } from 'nestjs-zod';
import { BiController } from '../src/modules/business-intelligence/controllers/bi.controller';
import { BiMetricsController } from '../src/modules/business-intelligence/controllers/bi-metrics.controller';
import { DashboardService } from '../src/modules/business-intelligence/services/dashboard.service';
import { BiMetricsService } from '../src/modules/business-intelligence/services/bi-metrics.service';
import { OperationsReadRepository } from '../src/modules/business-intelligence/repositories/operations-read.repository';
import { DashboardRepository } from '../src/modules/business-intelligence/repositories/dashboard.repository';
import { CredentialRepository } from '../src/common/repositories/credential.repository';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';
import { UnavailableError } from '../src/common/errors/application.error';

describe('BI HTTP authorization and failures', () => {
  let app: INestApplication;
  let tokens: Record<string, string>;
  const tenant = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const secret = 'synthetic-test-key-with-at-least-32-characters';
  const repository = { dashboard: jest.fn() }; const metrics = { render: jest.fn().mockResolvedValue('tms_bi_tenants_stale 0\n') };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [BiController, BiMetricsController], providers: [DashboardService, JwtService,
      { provide: ConfigService, useValue: { getOrThrow: () => ({ jwt: { secret }, metricsToken: 'synthetic-metrics-token' }) } },
      { provide: DashboardRepository, useValue: repository },
      { provide: OperationsReadRepository, useValue: { settings: async () => ({ frequencyHours: 1, delayToleranceMinutes: 60, scheduleEnabled: true }) } }, { provide: BiMetricsService, useValue: metrics },
      { provide: CredentialRepository, useValue: { findActiveUser: async (id: string) => ({ userId: id, tenantId: id === 'other' ? other : tenant,
        roles: [id === 'none' ? 'viewer' : id === 'editor' ? 'editor' : 'admin'] }) } },
    ] }).compile();
    app = module.createNestApplication(); app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ZodValidationPipe()); app.useGlobalFilters(new ApiExceptionFilter()); app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
    tokens = Object.fromEntries(['admin', 'editor', 'other', 'none'].map(sub => [sub, app.get(JwtService).sign({ sub, tenantId: sub === 'other' ? other : tenant }, { secret })]));
  });
  beforeEach(() => { repository.dashboard.mockReset().mockImplementation(async (tenantId, range) => ({ tenant: tenantId, range, freshness: { dataAgeSeconds: null } })); metrics.render.mockClear(); });
  afterAll(async () => { await app?.close(); });
  it('requires authentication and accepts both admin and editor with session-derived ownership', async () => {
    await request(app.getHttpServer()).get('/api/v1/bi/dashboard').expect(401);
    await request(app.getHttpServer()).get('/api/v1/bi/dashboard').auth(tokens.none!, { type: 'bearer' }).expect(403);
    for (const role of ['admin', 'editor', 'other']) {
      // Finite fixture identity list, never an arbitrary request key.
      // eslint-disable-next-line security/detect-object-injection
      const response = await request(app.getHttpServer()).get('/api/v1/bi/dashboard').auth(tokens[role]!, { type: 'bearer' }).expect(200);
      expect(response.body.success).toBe(true); expect(response.body.data.tenant).toBe(role === 'other' ? other : tenant);
      expect(response.headers['cache-control']).toBe('private, no-store');
    }
  });
  it('rejects tenant injection, invalid dates, future dates and excessive ranges before querying', async () => {
    for (const query of ['tenantId=foreign', 'from=2023-02-29', 'from=2024-03-01&to=2024-02-29', 'to=9999-01-01', 'from=2000-01-01']) {
      await request(app.getHttpServer()).get(`/api/v1/bi/dashboard?${query}`).auth(tokens.admin!, { type: 'bearer' }).expect(400);
    }
    expect(repository.dashboard).not.toHaveBeenCalled();
  });
  it('returns safe Problem Details for warehouse failure without an operational fallback', async () => {
    repository.dashboard.mockRejectedValueOnce(new UnavailableError('Business intelligence is unavailable', 'BI_UNAVAILABLE'));
    const response = await request(app.getHttpServer()).get('/api/v1/bi/dashboard').auth(tokens.editor!, { type: 'bearer' }).expect(503);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body.code).toBe('BI_UNAVAILABLE'); expect(response.body.success).toBeUndefined();
  });
  it('protects global BI metrics with the existing operator token before reading the warehouse', async () => {
    await request(app.getHttpServer()).get('/api/v1/internal/bi/metrics').expect(404);
    await request(app.getHttpServer()).get('/api/v1/internal/bi/metrics').auth(tokens.admin!, { type: 'bearer' }).expect(404);
    expect(metrics.render).not.toHaveBeenCalled();
    const response = await request(app.getHttpServer()).get('/api/v1/internal/bi/metrics').set('x-metrics-token', 'synthetic-metrics-token').expect(200);
    expect(response.text).toContain('tms_bi_tenants_stale'); expect(response.headers['content-type']).toContain('text/plain');
  });
});
