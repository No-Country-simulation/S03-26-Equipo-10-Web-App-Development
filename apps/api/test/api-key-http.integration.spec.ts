import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';

const databaseUrl = process.env.TEST_DATABASE_URL;
const redisUrl = process.env.TEST_REDIS_URL;
if (process.env.CI && (!databaseUrl || !redisUrl)) {
  throw new Error('TEST_DATABASE_URL and TEST_REDIS_URL are required for API key HTTP tests');
}
const describeWithServices = databaseUrl && redisUrl ? describe : describe.skip;

describeWithServices('API key HTTP contract', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    if (!databaseUrl || !redisUrl) throw new Error('Disposable services required');
    process.env.DATABASE_URL = databaseUrl;
    process.env.REDIS_URL = redisUrl;
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    process.env.API_KEY_PEPPERS_JSON = JSON.stringify({ '1': Buffer.alloc(32, 7).toString('base64url') });
    process.env.API_KEY_PEPPER_CURRENT_VERSION = '1';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    if (prisma && tenantId) {
      await prisma.auditLog.deleteMany({ where: { tenantId } });
      await prisma.apiKeyCredential.deleteMany({ where: { apiKey: { tenantId } } });
      await prisma.apiKey.deleteMany({ where: { tenantId } });
      await prisma.refreshToken.deleteMany({ where: { userId } });
      await prisma.refreshSession.deleteMany({ where: { userId } });
      await prisma.userRole.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } });
      await prisma.tenantFeatureFlag.deleteMany({ where: { tenantId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    if (prisma) await prisma.$disconnect();
    if (app) await app.close();
  });

  it('reveals once, enforces both endpoint scopes, rotates and revokes over HTTP', async () => {
    const agent = request.agent(app.getHttpServer());
    const email = `api-key-http-${randomUUID()}@example.test`;
    const registered = await agent.post('/api/v1/auth/register-admin')
      .set('Origin', 'http://localhost:3000').set('X-Auth-Mode', 'cookie')
      .send({ tenantName: `Key ${randomUUID()}`, email, password: 'SecurePassword123!' }).expect(201);
    tenantId = registered.body.data.user.tenantId;
    userId = registered.body.data.user.id;
    const flag = await prisma.featureFlag.upsert({
      where: { name: 'testimonials' }, update: {}, create: { name: 'testimonials' },
    });
    await prisma.tenantFeatureFlag.upsert({
      where: { tenantId_featureFlagId: { tenantId, featureFlagId: flag.id } },
      update: { enabled: true }, create: { tenantId, featureFlagId: flag.id, enabled: true },
    });
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
    const mutating = (path: string) => agent.post(path)
      .set('Origin', 'http://localhost:3000').set('X-Auth-Mode', 'cookie')
      .set('x-csrf-token', csrf.body.data.csrfToken as string);

    const created = await mutating('/api/v1/api-keys')
      .send({ name: 'Widget', scopes: ['testimonials:read'] }).expect(201);
    const id = created.body.data.id as string;
    const readKey = created.body.data.apiKey as string;
    expect(created.headers['cache-control']).toBe('no-store');
    expect(readKey).toMatch(/^ak_test_[0-9a-f]{16}_[0-9a-f]{64}$/);
    const list = await agent.get('/api/v1/api-keys').expect(200);
    expect(JSON.stringify(list.body)).not.toContain(readKey);
    expect(list.body.data[0]).toMatchObject({ id, scopes: ['testimonials:read'] });
    await request(app.getHttpServer()).get('/api/v1/public/testimonials')
      .set('Authorization', `Bearer ${readKey}`).expect(200);
    await request(app.getHttpServer()).post('/api/v1/public/analytics/events')
      .set('Authorization', `Bearer ${readKey}`)
      .send({ testimonialId: randomUUID(), eventType: 'view' }).expect(403);

    const rotated = await mutating(`/api/v1/api-keys/${id}/rotate`)
      .send({ scopes: ['analytics:write'] }).expect(201);
    const writeKey = rotated.body.data.apiKey as string;
    expect(rotated.headers['cache-control']).toBe('no-store');
    await request(app.getHttpServer()).get('/api/v1/public/testimonials')
      .set('Authorization', `Bearer ${writeKey}`).expect(403);
    await request(app.getHttpServer()).post('/api/v1/public/analytics/events')
      .set('Authorization', `Bearer ${writeKey}`)
      .send({ testimonialId: randomUUID(), eventType: 'view' }).expect(404);
    await request(app.getHttpServer()).post('/api/v1/public/analytics/events')
      .set('Authorization', `Bearer ${readKey}`)
      .send({ testimonialId: randomUUID(), eventType: 'view' }).expect(403);

    await agent.delete(`/api/v1/api-keys/${id}`)
      .set('Origin', 'http://localhost:3000').set('x-csrf-token', csrf.body.data.csrfToken as string)
      .expect(200);
    await request(app.getHttpServer()).get('/api/v1/public/testimonials')
      .set('Authorization', `Bearer ${readKey}`).expect(401);
    await request(app.getHttpServer()).get('/api/v1/public/testimonials')
      .set('Authorization', `Bearer ${writeKey}`).expect(401);
  }, 30000);
});
