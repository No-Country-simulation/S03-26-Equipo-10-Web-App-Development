import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Controller, Post, Req } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import type { INestApplication } from '@nestjs/common';
import type { Request } from 'express';
import request from 'supertest';
import { CsrfGuard } from '../src/common/guards/csrf.guard';
import { SessionCsrfService } from '../src/common/services/session-csrf.service';
import { RateLimitGuard } from '../src/common/guards/rate-limit.guard';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard';
import { ApiKeyScopesGuard } from '../src/common/guards/api-key-scopes.guard';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { FeatureFlagGuard } from '../src/common/guards/feature-flag.guard';
import { AuthController } from '../src/modules/auth/controllers/auth.controller';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { PublicTestimonialsController } from '../src/modules/testimonials/controllers/public-testimonials.controller';
import { TestimonialsService } from '../src/modules/testimonials/services/testimonials.service';
import { PublicAnalyticsController } from '../src/modules/analytics/controllers/public-analytics.controller';
import { AnalyticsService } from '../src/modules/analytics/services/analytics.service';

@Controller('protected')
class ProtectedController {
  @Post()
  mutate() { return { ok: true }; }

  @Post('ip')
  ip(@Req() req: Request) { return { ip: req.ip }; }
}

describe('CSRF y proxy por HTTP', () => {
  let app: INestApplication;
  const auth = {
    login: jest.fn().mockResolvedValue({ user: { id: 'user' }, tokens: { accessToken: 'access', refreshToken: 'refresh' } }),
    registerAdmin: jest.fn().mockResolvedValue({ user: { id: 'user' }, tokens: { accessToken: 'access', refreshToken: 'refresh' } }),
    refreshSession: jest.fn().mockResolvedValue({ user: { id: 'user' }, tokens: { accessToken: 'access', refreshToken: 'refresh' } }),
    logout: jest.fn().mockResolvedValue(undefined),
    assertActiveRefreshToken: jest.fn().mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController, PublicTestimonialsController, PublicAnalyticsController, ProtectedController],
      providers: [
        { provide: APP_GUARD, useClass: CsrfGuard },
        { provide: ConfigService, useValue: { getOrThrow: () => ({
          corsOrigin: 'https://web.example.test', authLegacyStartedAt: null,
          jwt: { secret: 'test-only-placeholder-with-at-least-32-characters' },
        }) } },
        SessionCsrfService,
        { provide: AuthService, useValue: auth },
        { provide: TestimonialsService, useValue: { submitPublicTestimonial: async () => ({ id: 'testimonial' }) } },
        { provide: AnalyticsService, useValue: { trackEvent: async () => ({ ok: true }), trackPublicEventBySlug: async () => ({ ok: true }) } },
      ],
    })
      .overrideGuard(RateLimitGuard).useValue({ canActivate: () => true })
      .overrideGuard(ApiKeyGuard).useValue({ canActivate: () => true })
      .overrideGuard(ApiKeyScopesGuard).useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideGuard(FeatureFlagGuard).useValue({ canActivate: () => true })
      .compile();

    app = module.createNestApplication();
    app.use(cookieParser());
    await app.init();
  });

  afterAll(async () => { if (app) await app.close(); });

  it('acepta login y registro con Origin permitido, incluso con cookies previas', async () => {
    await request(app.getHttpServer()).post('/auth/login')
      .set('Origin', 'https://web.example.test').set('Cookie', 'accessToken=old')
      .send({ email: 'test@example.test', password: 'secret' }).expect(201);
    await request(app.getHttpServer()).post('/auth/register-admin')
      .set('Origin', 'https://web.example.test')
      .send({ tenantName: 'Tenant', email: 'test@example.test', password: 'secret' }).expect(201);
    await request(app.getHttpServer()).post('/auth/refresh')
      .set('Origin', 'https://web.example.test').set('Cookie', 'accessToken=old')
      .send({ refreshToken: 'legacy-token' }).expect(201);
    await request(app.getHttpServer()).post('/auth/logout')
      .set('Origin', 'https://web.example.test').set('Cookie', 'accessToken=old')
      .send({ refreshToken: 'legacy-token' }).expect(201);
  });

  it('acepta formulario y analítica públicos, y una API key sin token CSRF', async () => {
    await request(app.getHttpServer()).post('/public/testimonials/tenant/submit')
      .set('Origin', 'https://web.example.test').send({ content: 'A valid testimonial' }).expect(201);
    await request(app.getHttpServer()).post('/public/analytics/tenants/tenant/events')
      .set('Origin', 'https://web.example.test').send({ eventType: 'view' }).expect(201);
    await request(app.getHttpServer()).post('/public/analytics/events')
      .set('Authorization', 'Bearer test-key').send({ eventType: 'view' }).expect(201);
  });

  it('rechaza Origin ajeno en mutaciones anónimas', async () => {
    await request(app.getHttpServer()).post('/auth/login')
      .set('Origin', 'https://evil.example.test').send({}).expect(403);
    await request(app.getHttpServer()).post('/public/testimonials/tenant/submit')
      .set('Origin', 'null').send({}).expect(403);
    await request(app.getHttpServer()).post('/auth/login')
      .set('Sec-Fetch-Site', 'cross-site').send({}).expect(403);
  });

  it('acepta el Origin del mismo host servido por Nginx', async () => {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
    await request(app.getHttpServer()).post('/auth/login')
      .set('Host', 'dev.testimonialcms.local')
      .set('X-Forwarded-Proto', 'https')
      .set('Origin', 'https://dev.testimonialcms.local')
      .send({}).expect(201);
    app.getHttpAdapter().getInstance().set('trust proxy', false);
  });

  it('permite Bearer y exige token CSRF cuando la sesión depende de cookie', async () => {
    const token = app.get(SessionCsrfService).tokenFor('refresh-token');
    await request(app.getHttpServer()).post('/protected')
      .set('Authorization', 'Bearer explicit-token').set('Cookie', 'accessToken=cookie-token')
      .send({}).expect(201);
    await request(app.getHttpServer()).post('/protected')
      .set('Cookie', 'accessToken=cookie-token; refreshToken=refresh-token')
      .send({}).expect(403);
    await request(app.getHttpServer()).post('/protected')
      .set('Cookie', 'accessToken=cookie-token; refreshToken=refresh-token')
      .set('x-csrf-token', 'wrong').send({}).expect(403);
    await request(app.getHttpServer()).post('/protected')
      .set('Origin', 'https://web.example.test')
      .set('Cookie', 'accessToken=cookie-token; refreshToken=refresh-token')
      .set('x-csrf-token', token).send({}).expect(201);
    const csrfResponse = await request(app.getHttpServer()).get('/auth/csrf')
      .set('Cookie', 'refreshToken=refresh-token').expect(200);
    expect(csrfResponse.body.csrfToken).toBe(token);
  });

  it('ignora X-Forwarded-For directo y usa el último salto al confiar en un proxy', async () => {
    const server = app.getHttpAdapter().getInstance();
    server.set('trust proxy', false);
    const direct = await request(app.getHttpServer()).post('/protected/ip')
      .set('Authorization', 'Bearer test').set('X-Forwarded-For', '1.1.1.1, 2.2.2.2').send({}).expect(201);
    expect(direct.body.ip).not.toBe('1.1.1.1');

    server.set('trust proxy', 1);
    const proxied = await request(app.getHttpServer()).post('/protected/ip')
      .set('Authorization', 'Bearer test').set('X-Forwarded-For', '1.1.1.1, 2.2.2.2').send({}).expect(201);
    expect(proxied.body.ip).toBe('2.2.2.2');
  });
});
