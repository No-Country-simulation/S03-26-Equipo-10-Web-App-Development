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
import { TenantLogoService } from '../src/modules/tenants/services/tenant-logo.service';
import { CredentialRepository } from '../src/common/repositories/credential.repository';
import { CsrfGuard } from '../src/common/guards/csrf.guard';
import { SessionCsrfService } from '../src/common/services/session-csrf.service';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { boundedJsonBody } from '../src/common/middleware/body-limits.middleware';
import { UnavailableError } from '../src/common/errors/application.error';

describe('company logo authorization over HTTP', () => {
  let app: INestApplication;
  let tokens: Record<string, string>;
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const otherId = '22222222-2222-4222-8222-222222222222';
  const logos = { upload: jest.fn(), remove: jest.fn() };
  const secret = 'synthetic-test-key-with-at-least-32-characters';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TenantsController], providers: [
        { provide: APP_GUARD, useClass: CsrfGuard }, SessionCsrfService, JwtService,
        { provide: ConfigService, useValue: { getOrThrow: () => ({ corsOrigin: 'https://web.example.test', jwt: { secret } }) } },
        { provide: TenantsService, useValue: { getTenant: jest.fn() } },
        { provide: TenantLogoService, useValue: logos },
        { provide: CredentialRepository, useValue: { findActiveUser: async (id: string) => ({
          userId: id, email: 'synthetic@example.test', tenantName: 'Synthetic', isActive: true,
          tenantId: id === 'other' ? otherId : tenantId, roles: [id === 'editor' ? 'editor' : 'admin'],
        }) } },
      ],
    }).compile();
    app = module.createNestApplication({ bodyParser: false });
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser(), boundedJsonBody);
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const jwt = app.get(JwtService);
    tokens = Object.fromEntries(['admin', 'editor', 'other'].map(sub => [sub,
      jwt.sign({ sub, tenantId: sub === 'other' ? otherId : tenantId }, { secret })]));
  });
  beforeEach(() => {
    jest.clearAllMocks();
    logos.upload.mockResolvedValue({ logoUrl: 'saved' });
    logos.remove.mockResolvedValue({ logoUrl: null });
  });
  afterAll(async () => { await app?.close(); });

  it('requires a session and admin role for both operations', async () => {
    await request(app.getHttpServer()).put('/api/v1/tenants/me/logo').send({ imageBase64: 'AAAA' }).expect(401);
    await request(app.getHttpServer()).put('/api/v1/tenants/me/logo')
      .auth(tokens.editor!, { type: 'bearer' }).send({ imageBase64: 'AAAA' }).expect(403);
    await request(app.getHttpServer()).delete('/api/v1/tenants/me/logo')
      .auth(tokens.editor!, { type: 'bearer' }).expect(403);
    expect(logos.upload).not.toHaveBeenCalled();
    expect(logos.remove).not.toHaveBeenCalled();
  });

  it('takes tenant ownership exclusively from the validated session', async () => {
    await request(app.getHttpServer()).put('/api/v1/tenants/me/logo')
      .auth(tokens.admin!, { type: 'bearer' }).send({ imageBase64: 'AAAA', tenantId: otherId }).expect(400);
    await request(app.getHttpServer()).put('/api/v1/tenants/me/logo')
      .auth(tokens.admin!, { type: 'bearer' }).send({ imageBase64: 'AAAA' }).expect(200);
    expect(logos.upload).toHaveBeenCalledWith(tenantId, 'AAAA');
    await request(app.getHttpServer()).delete('/api/v1/tenants/me/logo')
      .auth(tokens.other!, { type: 'bearer' }).expect(200);
    expect(logos.remove).toHaveBeenCalledWith(otherId);
  });

  it('protects cookie sessions with CSRF on upload and deletion', async () => {
    const cookie = `accessToken=${tokens.admin}; refreshToken=synthetic-refresh`;
    await request(app.getHttpServer()).put('/api/v1/tenants/me/logo')
      .set('Cookie', cookie).send({ imageBase64: 'AAAA' }).expect(403);
    await request(app.getHttpServer()).delete('/api/v1/tenants/me/logo').set('Cookie', cookie).expect(403);
    const csrf = app.get(SessionCsrfService).tokenFor('synthetic-refresh');
    await request(app.getHttpServer()).put('/api/v1/tenants/me/logo').set('Cookie', cookie)
      .set('Origin', 'https://web.example.test').set('x-csrf-token', csrf).send({ imageBase64: 'AAAA' }).expect(200);
    await request(app.getHttpServer()).delete('/api/v1/tenants/me/logo').set('Cookie', cookie)
      .set('Origin', 'https://web.example.test').set('x-csrf-token', csrf).expect(200);
  });

  it('returns a stable unavailable code without fabricating a successful logo', async () => {
    logos.upload.mockRejectedValueOnce(new UnavailableError('Image storage is unavailable', 'MEDIA_STORAGE_UNAVAILABLE'));
    const response = await request(app.getHttpServer()).put('/api/v1/tenants/me/logo')
      .auth(tokens.admin!, { type: 'bearer' }).send({ imageBase64: 'AAAA' }).expect(503);
    expect(response.body.code).toBe('MEDIA_STORAGE_UNAVAILABLE');
    expect(response.body.logoUrl).toBeUndefined();
  });

  it('reports oversized and malformed JSON as client errors before calling the logo service', async () => {
    const oversized = await request(app.getHttpServer()).put('/api/v1/tenants/me/logo')
      .auth(tokens.admin!, { type: 'bearer' }).send({ imageBase64: 'A'.repeat(3 * 1024 * 1024) }).expect(413);
    expect(oversized.body.code).toBe('PAYLOAD_TOO_LARGE');
    await request(app.getHttpServer()).put('/api/v1/tenants/me/logo').auth(tokens.admin!, { type: 'bearer' })
      .set('Content-Type', 'application/json').send('{invalid').expect(400);
    expect(logos.upload).not.toHaveBeenCalled();
  });
});
