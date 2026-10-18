import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { ZodValidationPipe } from 'nestjs-zod';
import { TenantsController } from '../src/modules/tenants/controllers/tenants.controller';
import { TenantsService } from '../src/modules/tenants/services/tenants.service';
import { TenantRepository } from '../src/modules/tenants/repositories/tenant.repository';
import { TenantLogoService } from '../src/modules/tenants/services/tenant-logo.service';
import { FeatureFlagsController } from '../src/modules/feature-flags/controllers/feature-flags.controller';
import { FeatureFlagsService } from '../src/modules/feature-flags/services/feature-flags.service';
import { FeatureFlagRepository } from '../src/modules/feature-flags/repositories/feature-flag.repository';
import { CredentialRepository } from '../src/common/repositories/credential.repository';
import { CsrfGuard } from '../src/common/guards/csrf.guard';
import { SessionCsrfService } from '../src/common/services/session-csrf.service';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';

// Actual HTTP guards, DTOs and services; repositories are synthetic, not PostgreSQL evidence.
describe('workspace settings HTTP contracts', () => {
  let app: INestApplication;
  let tokens: Record<string, string>;
  const tenantA = '11111111-1111-4111-8111-111111111111';
  const tenantB = '22222222-2222-4222-8222-222222222222';
  const tenantRepo = {
    findById: jest.fn(),
    update: jest.fn(),
    nameExists: jest.fn(),
    slugExists: jest.fn(),
  };
  const flagsRepo = { findAll: jest.fn(), setFlag: jest.fn() };
  const secret = 'synthetic-local-signing-key-at-least-32-characters';
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TenantsController, FeatureFlagsController],
      providers: [
        { provide: APP_GUARD, useClass: CsrfGuard },
        SessionCsrfService,
        JwtService,
        TenantsService,
        FeatureFlagsService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: () => ({
              corsOrigin: 'https://web.example.test',
              jwt: { secret },
            }),
          },
        },
        { provide: TenantRepository, useValue: tenantRepo },
        { provide: FeatureFlagRepository, useValue: flagsRepo },
        { provide: TenantLogoService, useValue: {} },
        {
          provide: CredentialRepository,
          useValue: {
            findActiveUser: async (id: string) => ({
              userId: id,
              email: 'synthetic@example.invalid',
              tenantName: 'Ejemplo',
              isActive: true,
              tenantId: id === 'other' ? tenantB : tenantA,
              roles: [id === 'editor' ? 'editor' : 'admin'],
            }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
    tokens = Object.fromEntries(
      ['admin', 'editor', 'other'].map((sub) => [
        sub,
        app
          .get(JwtService)
          .sign(
            { sub, tenantId: sub === 'other' ? tenantB : tenantA },
            { secret },
          ),
      ]),
    );
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    tenantRepo.nameExists.mockResolvedValue(false);
    tenantRepo.slugExists.mockResolvedValue(false);
    tenantRepo.update.mockImplementation(async (id, data) => ({ id, ...data }));
    flagsRepo.findAll.mockResolvedValue([
      { id: 'flag', name: 'enable_scoring', enabled: true, description: null },
    ]);
    flagsRepo.setFlag.mockImplementation(
      async (tenantId, flagName, enabled) => ({
        tenantId,
        flagName,
        enabled,
        updatedAt: new Date('2026-10-18T00:00:00Z'),
      }),
    );
  });
  const call = (path: string, token: string) =>
    request(app.getHttpServer())
      .patch(`/api/v1/${path}`)
      .auth(token, { type: 'bearer' });
  it('requires admin for tenant writes and flag reads/writes', async () => {
    await call('tenants/me', tokens.editor!)
      .send({ name: 'No permitido' })
      .expect(403);
    await call('feature-flags/enable_scoring', tokens.editor!)
      .send({ enabled: false })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/feature-flags')
      .auth(tokens.editor!, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer()).get('/api/v1/feature-flags').expect(401);
    expect(tenantRepo.update).not.toHaveBeenCalled();
    expect(flagsRepo.setFlag).not.toHaveBeenCalled();
  });
  it('passes only authenticated ownership and the supplied independent field', async () => {
    await call('tenants/me', tokens.admin!)
      .send({ name: 'Nombre nuevo' })
      .expect(200);
    expect(tenantRepo.update).toHaveBeenLastCalledWith(tenantA, {
      name: 'Nombre nuevo',
    });
    await call('tenants/me', tokens.other!)
      .send({ isPublicFormEnabled: false })
      .expect(200);
    expect(tenantRepo.update).toHaveBeenLastCalledWith(tenantB, {
      isPublicFormEnabled: false,
    });
    await call('feature-flags/enable_scoring', tokens.other!)
      .send({ enabled: false })
      .expect(200);
    expect(flagsRepo.setFlag).toHaveBeenLastCalledWith(
      tenantB,
      'enable_scoring',
      false,
    );
  });
  it('preserves list data plus meta and the distinct mutation result', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/feature-flags')
      .auth(tokens.admin!, { type: 'bearer' })
      .expect(200);
    expect(list.body).toMatchObject({
      success: true,
      data: [{ name: 'enable_scoring', enabled: true }],
      meta: { page: 1, limit: 1, total: 1 },
    });
    const mutation = await call('feature-flags/enable_scoring', tokens.admin!)
      .send({ enabled: false })
      .expect(200);
    expect(mutation.body.data).toEqual({
      tenantId: tenantA,
      flagName: 'enable_scoring',
      enabled: false,
      updatedAt: '2026-10-18T00:00:00.000Z',
    });
  });
  it('validates names, slug and booleans while ignoring client ownership', async () => {
    for (const input of [
      { name: 'ab' },
      { name: 'x'.repeat(121) },
      { publicSlug: 'MAYUSCULAS' },
      { isPublicFormEnabled: 'false' },
    ])
      await call('tenants/me', tokens.admin!).send(input).expect(400);
    expect(tenantRepo.update).not.toHaveBeenCalled();
    await call('tenants/me', tokens.admin!)
      .send({ tenantId: tenantB, name: 'Nombre propio' })
      .expect(200);
    expect(tenantRepo.update).toHaveBeenCalledWith(tenantA, {
      name: 'Nombre propio',
    });
    await call('feature-flags/enable_scoring', tokens.admin!)
      .send({ enabled: false, tenantId: tenantB })
      .expect(200);
    expect(flagsRepo.setFlag).toHaveBeenCalledWith(
      tenantA,
      'enable_scoring',
      false,
    );
  });
  it('returns conflicts before changing a taken name or slug', async () => {
    tenantRepo.nameExists.mockResolvedValueOnce(true);
    await call('tenants/me', tokens.admin!)
      .send({ name: 'Nombre ocupado' })
      .expect(409);
    expect(tenantRepo.nameExists).toHaveBeenCalledWith(
      'Nombre ocupado',
      tenantA,
    );
    tenantRepo.slugExists.mockResolvedValueOnce(true);
    await call('tenants/me', tokens.admin!)
      .send({ publicSlug: 'ocupado' })
      .expect(409);
    expect(tenantRepo.update).not.toHaveBeenCalled();
  });
  it('requires CSRF for both writes using cookies', async () => {
    const cookie = `accessToken=${tokens.admin}; refreshToken=synthetic-refresh`;
    for (const [path, input] of [
      ['tenants/me', { name: 'Nombre seguro' }],
      ['feature-flags/enable_scoring', { enabled: false }],
    ] as const) {
      await request(app.getHttpServer())
        .patch(`/api/v1/${path}`)
        .set('Cookie', cookie)
        .send(input)
        .expect(403);
      await request(app.getHttpServer())
        .patch(`/api/v1/${path}`)
        .set('Cookie', cookie)
        .set('Origin', 'https://web.example.test')
        .set(
          'x-csrf-token',
          app.get(SessionCsrfService).tokenFor('synthetic-refresh'),
        )
        .send(input)
        .expect(200);
    }
  });
});
