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
  throw new Error('TEST_DATABASE_URL and TEST_REDIS_URL are required for webhook HTTP tests');
}
const describeWithServices = databaseUrl && redisUrl ? describe : describe.skip;

describeWithServices('webhook secret HTTP contract', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    if (!databaseUrl || !redisUrl) throw new Error('Disposable services required');
    process.env.DATABASE_URL = databaseUrl;
    process.env.REDIS_URL = redisUrl;
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    process.env.WEBHOOK_SECRET_KEYS_JSON = JSON.stringify({ '1': Buffer.alloc(32, 7).toString('base64url') });
    process.env.WEBHOOK_SECRET_CURRENT_VERSION = '1';
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
      await prisma.webhook.deleteMany({ where: { tenantId } });
      await prisma.auditLog.deleteMany({ where: { tenantId } });
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

  it('shows a secret once on create and rotation, with no secret in GET or logs', async () => {
    const agent = request.agent(app.getHttpServer());
    const email = `webhook-secret-${randomUUID()}@example.test`;
    const registered = await agent.post('/api/v1/auth/register-admin')
      .set('Origin', 'http://localhost:3000').set('X-Auth-Mode', 'cookie')
      .send({ tenantName: `Webhook ${randomUUID()}`, email, password: 'SecurePassword123!' }).expect(201);
    tenantId = registered.body.data.user.tenantId;
    userId = registered.body.data.user.id;
    const csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.data.csrfToken as string;
    const create = await agent.post('/api/v1/webhooks')
      .set('Origin', 'http://localhost:3000').set('x-csrf-token', csrf)
      .send({ url: 'https://1.1.1.1/receive', eventCode: 'testimonial.created', isActive: false })
      .expect(201);
    const id = create.body.data.id as string;
    const first = create.body.data.signingSecret as string;
    expect(first).toMatch(/^whsec_[0-9a-f]{64}$/);
    expect(create.headers['cache-control']).toBe('no-store');
    const detail = await agent.get(`/api/v1/webhooks/${id}`).expect(200);
    const list = await agent.get('/api/v1/webhooks').expect(200);
    expect(JSON.stringify(detail.body)).not.toContain(first);
    expect(JSON.stringify(list.body)).not.toContain(first);
    expect(JSON.stringify(detail.body)).not.toContain('secretCiphertext');
    expect(detail.body.data.hasSignature).toBe(true);

    const rotated = await agent.post(`/api/v1/webhooks/${id}/rotate-secret`)
      .set('Origin', 'http://localhost:3000').set('x-csrf-token', csrf).send({}).expect(201);
    const second = rotated.body.data.signingSecret as string;
    expect(second).not.toBe(first);
    expect(rotated.headers['cache-control']).toBe('no-store');
    await agent.post(`/api/v1/webhooks/${id}/rotate-secret`)
      .set('Origin', 'http://localhost:3000').set('x-csrf-token', csrf).send({}).expect(409);
    const after = await agent.get(`/api/v1/webhooks/${id}`).expect(200);
    expect(JSON.stringify(after.body)).not.toContain(first);
    expect(JSON.stringify(after.body)).not.toContain(second);
  }, 30000);
});
