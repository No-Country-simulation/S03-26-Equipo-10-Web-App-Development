import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import {
  Controller,
  Get,
  UseGuards,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { PrismaService } from '../src/modules/database/prisma.service';
import { CredentialRepository } from '../src/common/repositories/credential.repository';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';
import { UsersController } from '../src/modules/users/controllers/users.controller';
import { UsersService } from '../src/modules/users/services/users.service';
import { UserRepository } from '../src/modules/users/repositories/user.repository';
import { PasswordService } from '../src/modules/shared/hashing';
import { BillingOperatorGuard } from '../src/modules/billing/guards/billing-operator.guard';
import { BillingOperatorRepository } from '../src/modules/billing/repositories/billing-operator.repository';
import { runOperatorCommand } from '../src/modules/billing/operator.cli';
import { createBillingDatabase } from './fixtures/billing-postgres';

@Controller('test-billing-operator')
@UseGuards(JwtAuthGuard, BillingOperatorGuard)
class OperatorProbeController {
  @Get() get() {
    return { allowed: true };
  }
}

const parentUrl =
  process.env.TEST_BILLING_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
const describeDatabase = parentUrl ? describe : describe.skip;
describeDatabase('billing operator HTTP/CLI against owned PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createBillingDatabase>>;
  let app: INestApplication;
  let operators: BillingOperatorRepository;
  let tenantId: string;
  let actorId: string;
  let userId: string;
  let token: string;
  const jwtSecret = randomBytes(32).toString('hex');
  beforeAll(async () => {
    fixture = await createBillingDatabase(parentUrl!);
    const db = fixture.prisma;
    tenantId = (
      await db.tenant.create({
        data: { name: `Synthetic HTTP ${randomUUID()}` },
      })
    ).id;
    const admin = await db.role.upsert({
      where: { code: 'admin' },
      create: { code: 'admin' },
      update: {},
    });
    actorId = (
      await db.user.create({
        data: {
          tenantId,
          email: `${randomUUID()}@example.invalid`,
          passwordHash: 'non-authenticatable-synthetic-hash',
          roles: { create: { roleId: admin.id } },
        },
      })
    ).id;
    const module = await Test.createTestingModule({
      controllers: [UsersController, OperatorProbeController],
      providers: [
        UsersService,
        UserRepository,
        CredentialRepository,
        JwtService,
        BillingOperatorGuard,
        BillingOperatorRepository,
        { provide: PrismaService, useValue: db },
        {
          provide: PasswordService,
          useValue: {
            hashPassword: async () => 'non-authenticatable-synthetic-hash',
          },
        },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => ({ jwt: { secret: jwtSecret } }) },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ZodValidationPipe());
    app.useGlobalFilters(new ApiExceptionFilter());
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
    operators = module.get(BillingOperatorRepository);
    // A forged global role claim is deliberately present; it must confer nothing.
    token = module
      .get(JwtService)
      .sign(
        { sub: actorId, tenantId, roles: ['platform_operator'] },
        { secret: jwtSecret },
      );
  }, 90000);
  beforeEach(async () => {
    userId = (
      await fixture.prisma.user.create({
        data: {
          tenantId,
          email: `${randomUUID()}@example.invalid`,
          passwordHash: 'non-authenticatable-synthetic-hash',
        },
      })
    ).id;
  });
  afterAll(async () => {
    await app?.close();
    await fixture?.close();
  });
  const probe = () =>
    request(app.getHttpServer())
      .get('/api/v1/test-billing-operator')
      .auth(token, { type: 'bearer' });

  it('consults live DB membership for an existing token and revokes privilege immediately', async () => {
    await probe().expect(403);
    await operators.setMembership(actorId, true);
    await probe().expect(200);
    await operators.setMembership(actorId, false);
    await probe().expect(403);
  });
  it('prevents a tenant admin from changing operator password or activation via the real HTTP pipeline', async () => {
    await operators.setMembership(userId, true);
    const result = await request(app.getHttpServer())
      .patch(`/api/v1/users/${userId}`)
      .auth(token, { type: 'bearer' })
      .send({ isActive: false })
      .expect(409);
    expect(result.body.code).toBe('BILLING_OPERATOR_PROTECTED');
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${userId}`)
      .auth(token, { type: 'bearer' })
      .send({ password: `${randomBytes(16).toString('hex')}Aa1!` })
      .expect(409);
    expect(
      (await fixture.prisma.user.findUniqueOrThrow({ where: { id: userId } }))
        .isActive,
    ).toBe(true);
    await operators.setMembership(userId, false);
    await request(app.getHttpServer())
      .delete(`/api/v1/users/${userId}`)
      .auth(token, { type: 'bearer' })
      .expect(409);
  });
  it('allows normal tenant user updates and cannot grant an operator through user DTO fields', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/users/${userId}`)
      .auth(token, { type: 'bearer' })
      .send({ isActive: false })
      .expect(200);
    const created = await request(app.getHttpServer())
      .post('/api/v1/users')
      .auth(token, { type: 'bearer' })
      .send({
        email: `${randomUUID()}@example.invalid`,
        password: `${randomBytes(16).toString('hex')}Aa1!`,
        role: 'editor',
        platformOperator: true,
      })
      .expect(201);
    expect(await operators.isOperator(created.body.data.id)).toBe(false);
  });
  it('CLI rejects mutation without explicit apply and UUID before connecting', async () => {
    await expect(
      runOperatorCommand(['grant', userId], fixture.url),
    ).rejects.toThrow('BILLING_OPERATOR_CLI_INPUT_INVALID');
    await expect(
      runOperatorCommand(['grant', 'not-a-uuid', '--apply'], fixture.url),
    ).rejects.toThrow();
    expect(await operators.isOperator(userId)).toBe(false);
  });
  it('CLI grant/check/revoke uses a dedicated external DSN and only prints the permission result', () => {
    const run = (args: string[]) =>
      JSON.parse(
        execFileSync(
          process.execPath,
          [
            '--require',
            require.resolve('ts-node/register'),
            resolve(__dirname, '../src/modules/billing/operator.cli.ts'),
            ...args,
          ],
          {
            env: {
              ...process.env,
              TS_NODE_PROJECT: resolve(__dirname, '../tsconfig.json'),
              BILLING_OPERATOR_DATABASE_URL: fixture.url,
            },
            stdio: 'pipe',
            encoding: 'utf8',
            timeout: 60000,
          },
        ),
      );
    expect(run(['check', userId])).toEqual({ allowed: false });
    expect(run(['grant', userId, '--apply'])).toEqual({ allowed: true });
    expect(run(['revoke', userId, '--apply'])).toEqual({ allowed: false });
  }, 90000);
});
