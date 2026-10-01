import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testRedisUrl = process.env.TEST_REDIS_URL;
if (process.env.CI && (!testDatabaseUrl || !testRedisUrl)) {
  throw new Error('TEST_DATABASE_URL and TEST_REDIS_URL are required in CI for cookie HTTP tests');
}
const describeWithServices = testDatabaseUrl && testRedisUrl ? describe : describe.skip;

describeWithServices('cookie authentication over HTTP', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    if (!testDatabaseUrl || !testRedisUrl) throw new Error('Disposable services required');
    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.REDIS_URL = testRedisUrl;
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await prisma.$connect();
  });

  afterAll(async () => {
    if (prisma && userId) {
      await prisma.auditLog.deleteMany({ where: { userId } });
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

  it('registers, signs in, refreshes and logs out with HttpOnly cookies and CSRF', async () => {
    const agent = request.agent(app.getHttpServer());
    const email = `cookie-${randomUUID()}@example.test`;
    const tenantName = `Cookie ${randomUUID()}`;
    const register = await agent.post('/api/v1/auth/register-admin')
      .set('Origin', 'http://localhost:3000')
      .set('X-Auth-Mode', 'cookie')
      .send({ tenantName, email, password: 'SecurePassword123!' }).expect(201);
    expect(register.body.data).toMatchObject({ user: { email } });
    expect(register.body.data.tokens).toBeUndefined();
    expect(String(register.headers['set-cookie'])).toContain('HttpOnly');
    userId = register.body.data.user.id;
    tenantId = register.body.data.user.tenantId;

    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
    const token = csrf.body.data.csrfToken as string;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(csrf.headers['cache-control']).toBe('no-store');
    await agent.post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:3000')
      .set('X-Auth-Mode', 'cookie')
      .set('x-csrf-token', 'invalid')
      .send({}).expect(403);

    const refresh = await agent.post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:3000')
      .set('X-Auth-Mode', 'cookie')
      .set('x-csrf-token', token)
      .send({}).expect(201);
    expect(refresh.body.data.tokens).toBeUndefined();
    await agent.get('/api/v1/auth/me').expect(200);

    const nextCsrf = await agent.get('/api/v1/auth/csrf').expect(200);
    expect(nextCsrf.body.data.csrfToken).not.toBe(token);
    await agent.post('/api/v1/auth/logout')
      .set('Origin', 'http://localhost:3000')
      .set('X-Auth-Mode', 'cookie')
      .set('x-csrf-token', nextCsrf.body.data.csrfToken)
      .send({}).expect(201);
    await agent.get('/api/v1/auth/me').expect(401);

    const login = await agent.post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-Auth-Mode', 'cookie')
      .send({ email, password: 'SecurePassword123!' }).expect(201);
    expect(login.body.data.tokens).toBeUndefined();

    const bearer = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('X-Auth-Mode', 'bearer')
      .send({ email, password: 'SecurePassword123!' }).expect(201);
    expect(bearer.body.data.tokens.refreshToken).toEqual(expect.any(String));
    expect(bearer.headers['set-cookie']).toBeUndefined();

    const upgradeAgent = request.agent(app.getHttpServer());
    const legacyRefresh = bearer.body.data.tokens.refreshToken as string;
    const upgrade = await upgradeAgent.post('/api/v1/auth/upgrade-session')
      .set('Origin', 'http://localhost:3000')
      .send({ refreshToken: legacyRefresh }).expect(201);
    expect(upgrade.body.data.tokens).toBeUndefined();
    await upgradeAgent.get('/api/v1/auth/me').expect(200);
    await request(app.getHttpServer()).post('/api/v1/auth/upgrade-session')
      .set('Origin', 'http://localhost:3000')
      .send({ refreshToken: legacyRefresh }).expect(401);
    await upgradeAgent.get('/api/v1/auth/me').expect(401);
    await request(app.getHttpServer()).get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${bearer.body.data.tokens.accessToken as string}`)
      .expect(401);
  }, 30000);
});
