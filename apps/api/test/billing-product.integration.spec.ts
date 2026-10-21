import cookieParser from 'cookie-parser';
import { APP_GUARD } from '@nestjs/core';
import { CsrfGuard } from '../src/common/guards/csrf.guard';
import { SessionCsrfService } from '../src/common/services/session-csrf.service';
import { UsersController } from '../src/modules/users/controllers/users.controller';
import { UsersService } from '../src/modules/users/services/users.service';
import { PasswordService } from '../src/modules/shared/hashing';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { Controller, Post, Param, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import { createBillingDatabase } from './fixtures/billing-postgres';
import { PrismaService } from '../src/modules/database/prisma.service';
import { CredentialRepository } from '../src/common/repositories/credential.repository';
import { IdempotencyRepository } from '../src/common/repositories/idempotency.repository';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';
import { BillingController } from '../src/modules/billing/controllers/billing.controller';
import { PlatformBillingController } from '../src/modules/billing/controllers/platform-billing.controller';
import { BillingAccessRepository } from '../src/modules/billing/repositories/billing-access.repository';
import { BillingProductRepository } from '../src/modules/billing/repositories/billing-product.repository';
import { BillingTenantRepository } from '../src/modules/billing/repositories/billing-tenant.repository';
import { BillingSettlementRepository } from '../src/modules/billing/repositories/billing-settlement.repository';
import { BillingLedgerRepository } from '../src/modules/billing/repositories/billing-ledger.repository';
import { BillingCatalogRepository } from '../src/modules/billing/repositories/billing-catalog.repository';
import { BillingOperatorRepository } from '../src/modules/billing/repositories/billing-operator.repository';
import { BillingOperatorGuard } from '../src/modules/billing/guards/billing-operator.guard';
import { BillingProductService } from '../src/modules/billing/services/billing-product.service';
import { BillingGateways } from '../src/modules/billing/services/billing-gateways.service';
import { BillingProcessor } from '../src/modules/billing/services/billing-processor.service';
import { BillingCmsInterceptor } from '../src/modules/billing/services/billing-cms.interceptor';
import {
  BILLING_CONFIG,
  type BillingConfig,
} from '../src/modules/billing/integrations/billing.config';
import { UserRepository } from '../src/modules/users/repositories/user.repository';
import { TestimonialRepository } from '../src/modules/testimonials/repositories/testimonial.repository';
import { WebhookRepository } from '../src/modules/webhooks/repositories/webhook.repository';
import { OutboxRepository } from '../src/modules/webhooks/repositories/outbox.repository';
import { ApiKeyRepository } from '../src/modules/api-keys/repositories/api-key.repository';
import { FeatureFlagRepository } from '../src/modules/feature-flags/repositories/feature-flag.repository';
import { SourceRepository } from '../src/modules/business-intelligence/repositories/source.repository';

// Anonymous capture still enforces capacity in its repository, without a session interceptor.
@Controller('public/billing-capacity-probe')
class CaptureProbe {
  constructor(private readonly testimonials: TestimonialRepository) {}
  @Post(':id') create(@Param('id') tenantId: string) {
    return this.testimonials.createWithEvent(
      {
        tenantId,
        createdById: null,
        authorName: 'Synthetic',
        content: 'Synthetic public capture',
        rating: 5,
      },
      'pending',
      { eventType: 'testimonial.created', payload: (v) => ({ id: v.id }) },
    );
  }
}
const parent =
  process.env.TEST_BILLING_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
(parent ? describe : describe.skip)(
  'billing product: HTTP + real PostgreSQL + local financial simulator',
  () => {
    let fixture: Awaited<ReturnType<typeof createBillingDatabase>>,
      db: PrismaClient,
      app: INestApplication;
    let access: BillingAccessRepository,
      product: BillingProductRepository,
      operators: BillingOperatorRepository,
      users: UserRepository,
      hooks: WebhookRepository,
      keys: ApiKeyRepository,
      outbox: OutboxRepository,
      processor: BillingProcessor;
    let tenantId: string,
      actorId: string,
      token: string,
      editorToken: string,
      otherToken: string,
      versionId: string,
      priceId: string,
      accountId: string;
    const jwt = new JwtService(),
      secret = 'synthetic-only-http-secret-at-least-32';
    const config: BillingConfig = {
      mode: 'simulation',
      returnUrl: 'http://localhost:3000/admin/billing/return',
      simulationKey: 'synthetic-only-simulation-key-at-least-32',
    };
    beforeAll(async () => {
      fixture = await createBillingDatabase(parent!);
      db = fixture.prisma;
      const prisma = db as unknown as PrismaService;
      access = new BillingAccessRepository(prisma, config);
      const tenants = new BillingTenantRepository(prisma),
        settlements = new BillingSettlementRepository(prisma),
        ledger = new BillingLedgerRepository(prisma, settlements),
        receipts = new IdempotencyRepository(prisma),
        catalog = new BillingCatalogRepository(prisma);
      product = new BillingProductRepository(
        prisma,
        access,
        tenants,
        settlements,
        ledger,
        receipts,
        config,
      );
      const gateways = new BillingGateways(config, ledger);
      processor = new BillingProcessor(ledger, gateways);
      operators = new BillingOperatorRepository(prisma);
      users = new UserRepository(prisma, access);
      hooks = new WebhookRepository(prisma, access);
      keys = new ApiKeyRepository(prisma, access);
      outbox = new OutboxRepository(prisma, access);
      const module = await Test.createTestingModule({
        controllers: [
          BillingController,
          PlatformBillingController,
          UsersController,
          CaptureProbe,
        ],
        providers: [
          UsersService,
          { provide: UserRepository, useValue: users },
          {
            provide: PasswordService,
            useValue: {
              hashPassword: async () => 'synthetic-non-authenticatable',
            },
          },
          { provide: APP_GUARD, useClass: CsrfGuard },
          SessionCsrfService,
          { provide: PrismaService, useValue: db },
          CredentialRepository,
          { provide: JwtService, useValue: jwt },
          {
            provide: ConfigService,
            useValue: {
              getOrThrow: () => ({
                jwt: { secret },
                corsOrigin: 'http://localhost:3000',
              }),
            },
          },
          { provide: BILLING_CONFIG, useValue: config },
          BillingOperatorGuard,
          { provide: BillingOperatorRepository, useValue: operators },
          {
            provide: BillingProductService,
            useValue: new BillingProductService(
              product,
              gateways,
              ledger,
              processor,
            ),
          },
          { provide: BillingCatalogRepository, useValue: catalog },
          { provide: BillingLedgerRepository, useValue: ledger },
          { provide: BillingTenantRepository, useValue: tenants },
          {
            provide: TestimonialRepository,
            useValue: new TestimonialRepository(prisma, access),
          },
        ],
      }).compile();
      app = module.createNestApplication();
      app.setGlobalPrefix('api/v1');
      app.use(cookieParser());
      app.useGlobalPipes(new ZodValidationPipe());
      app.useGlobalFilters(new ApiExceptionFilter());
      app.useGlobalInterceptors(
        new ApiResponseInterceptor(),
        new BillingCmsInterceptor(access),
      );
      await app.init();
      for (const code of ['admin', 'editor'])
        await db.role.upsert({ where: { code }, create: { code }, update: {} });
      for (const code of ['draft', 'pending'])
        await db.testimonialStatus.upsert({
          where: { code },
          create: { code },
          update: {},
        });
      await db.webhookEvent.upsert({
        where: { code: 'testimonial.created' },
        create: { code: 'testimonial.created' },
        update: {},
      });
      accountId = (
        await db.billingProviderAccount.create({
          data: {
            provider: 'stripe',
            environment: 'sandbox',
            sellerId: 'synthetic-seller',
            configurationKey: 'BILLING_SIMULATION',
            enabled: true,
          },
        })
      ).id;
      const plan = await db.billingPlan.create({
        data: { code: 'synthetic-product' },
      });
      const version = await db.billingPlanVersion.create({
        data: {
          planId: plan.id,
          version: 1,
          name: 'Synthetic product',
          trialDays: 14,
          graceDays: 7,
          activeUsers: 3,
          storedTestimonials: 1,
          activeApiKeys: 1,
          activeWebhooks: 1,
          media: false,
          analytics: false,
          scoring: false,
          businessIntelligence: true,
          biStatistics: false,
          apiKeys: true,
          webhooks: true,
        },
      });
      versionId = version.id;
      priceId = (
        await db.billingPrice.create({
          data: {
            planVersionId: versionId,
            provider: 'stripe',
            currency: 'USD',
            interval: 'month',
            amountMinor: 1999n,
            manualEnabled: true,
            automaticEnabled: true,
          },
        })
      ).id;
      await db.billingPlanVersion.update({
        where: { id: versionId },
        data: { status: 'published', publishedAt: new Date() },
      });
      await db.billingPriceBinding.create({
        data: {
          priceId,
          planVersionId: versionId,
          providerAccountId: accountId,
          provider: 'stripe',
          environment: 'sandbox',
          status: 'ready',
        },
      });
    }, 90000);
    beforeEach(async () => {
      tenantId = (
        await db.tenant.create({ data: { name: `Synthetic ${randomUUID()}` } })
      ).id;
      const createUser = async (role: string, tid = tenantId) =>
        db.user.create({
          data: {
            tenantId: tid,
            email: `${randomUUID()}@example.invalid`,
            passwordHash: 'non-authenticatable-synthetic',
            roles: { create: { role: { connect: { code: role } } } },
          },
        });
      actorId = (await createUser('admin')).id;
      const editor = await createUser('editor');
      token = jwt.sign(
        { sub: actorId, tenantId, roles: ['platform_operator'] },
        { secret },
      );
      editorToken = jwt.sign({ sub: editor.id, tenantId }, { secret });
      const otherTenant = (
        await db.tenant.create({
          data: { name: `Synthetic other ${randomUUID()}` },
        })
      ).id;
      const other = await createUser('admin', otherTenant);
      otherToken = jwt.sign(
        { sub: other.id, tenantId: otherTenant },
        { secret },
      );
      await db.billingAccount.create({
        data: { tenantId, enforcementEnabled: true },
      });
    });
    afterAll(async () => {
      await app?.close();
      await fixture?.close();
    }, 30000);
    const call = (
      method: 'get' | 'post' | 'patch',
      path: string,
      auth = token,
    ) =>
      (method === 'post'
        ? request(app.getHttpServer()).post(`/api/v1${path}`)
        : method === 'patch'
          ? request(app.getHttpServer()).patch(`/api/v1${path}`)
          : request(app.getHttpServer()).get(`/api/v1${path}`)
      ).auth(auth, { type: 'bearer' });
    async function trial() {
      await call('post', '/billing/trial')
        .set('idempotency-key', randomUUID())
        .send({ planVersionId: versionId })
        .expect(201);
    }
    async function operator() {
      await operators.setMembership(actorId, true);
    }
    async function checkout(mode = 'manual') {
      return (
        await call('post', '/billing/checkouts')
          .set('idempotency-key', randomUUID())
          .send({ priceId, mode })
          .expect(202)
      ).body.data.operationId as string;
    }
    test('only tenant admin manages billing; a forged operator claim grants nothing and revocation is immediate', async () => {
      await call('get', '/billing/summary', editorToken).expect(403);
      const editor = (
        await call('get', '/billing/entitlements', editorToken).expect(200)
      ).body.data;
      expect(editor.subscription).toBeNull();
      expect(editor.isOperator).toBe(false);
      await call('get', '/platform/billing').expect(403);
      await operator();
      await call('get', '/platform/billing').expect(200);
      await operators.setMembership(actorId, false);
      await call('get', '/platform/billing').expect(403);
    });
    test('trial requires a key, rejects extra commercial fields and is globally one-time despite concurrent replay', async () => {
      await call('post', '/billing/trial')
        .send({ planVersionId: versionId })
        .expect(400);
      await call('post', '/billing/trial')
        .set('idempotency-key', 'tampered')
        .send({ planVersionId: versionId, tenantId })
        .expect(400);
      const run = () =>
        call('post', '/billing/trial')
          .set('idempotency-key', 'same-trial')
          .send({ planVersionId: versionId });
      const replies = await Promise.all([run(), run(), run()]);
      expect(replies.map((r) => r.status)).toEqual([201, 201, 201]);
      expect(new Set(replies.map((r) => r.body.data.id)).size).toBe(1);
      expect(
        await db.billingAccessPeriod.count({
          where: { tenantId, kind: 'trial' },
        }),
      ).toBe(1);
      await call('post', '/billing/trial')
        .set('idempotency-key', 'other-trial')
        .send({ planVersionId: versionId })
        .expect(409);
      await call('post', '/billing/trial')
        .set('idempotency-key', 'same-trial')
        .send({ planVersionId: randomUUID() })
        .expect(409);
    });
    test('checkout uses server money; scoped return remains pending until verified settlement, trial then ends once', async () => {
      await trial();
      await call('post', '/billing/checkouts')
        .set('idempotency-key', randomUUID())
        .send({ priceId, mode: 'manual', amountMinor: '1' })
        .expect(400);
      const id = await checkout();
      await call('get', `/billing/operations/${id}`, otherToken).expect(404);
      const pending = (
        await call('get', `/billing/operations/${id}`).expect(200)
      ).body.data;
      expect(pending.paymentStatus).toBe('pending');
      expect(pending.redirectUrl).toContain(`operation=${id}`);
      expect(
        (await db.billingObligation.findFirstOrThrow({ where: { tenantId } }))
          .amountMinor,
      ).toBe(1999n);
      await call('post', `/platform/billing/operations/${id}/simulate`)
        .set('idempotency-key', 'forbidden')
        .send({
          scenario: 'approved',
          at: new Date().toISOString(),
          cycle: 'initial',
        })
        .expect(403);
      await operator();
      const at = new Date().toISOString();
      for (let i = 0; i < 2; i++)
        await call('post', `/platform/billing/operations/${id}/simulate`)
          .set('idempotency-key', 'approved-once')
          .send({ scenario: 'approved', at, cycle: 'initial' })
          .expect(202);
      const confirmed = (
        await call('get', `/billing/operations/${id}`).expect(200)
      ).body.data;
      expect(confirmed.paymentStatus).toBe('confirmed');
      expect(confirmed.redirectUrl).toBeUndefined();
      expect(
        await db.billingAccessPeriod.count({
          where: { tenantId, kind: 'paid' },
        }),
      ).toBe(1);
      expect((await access.snapshot(tenantId)).access.mode).toBe('paid');
      expect(
        (
          await db.billingAccessPeriod.findFirstOrThrow({
            where: { tenantId, kind: 'trial' },
          })
        ).revokedAt,
      ).not.toBeNull();
    });
    test('anonymous capture enforces stored capacity atomically and maps a quota failure to Problem Details', async () => {
      await trial();
      const send = () =>
        request(app.getHttpServer())
          .post(`/api/v1/public/billing-capacity-probe/${tenantId}`)
          .send({});
      const replies = await Promise.all([send(), send(), send(), send()]);
      expect(replies.map((r) => r.status).sort()).toEqual([201, 409, 409, 409]);
      for (const r of replies.filter((r) => r.status !== 201)) {
        expect(r.body.code).toBe('BILLING_QUOTA_EXCEEDED');
        expect(r.type).toBe('application/problem+json');
      }
      expect(await db.testimonial.count({ where: { tenantId } })).toBe(1);
    });
    test('active users count the administrator and serialize creations plus reactivations', async () => {
      await trial();
      const attempts = await Promise.allSettled(
        Array.from({ length: 4 }, () =>
          users.create({
            tenantId,
            email: `${randomUUID()}@example.invalid`,
            passwordHash: 'synthetic',
            roleCode: 'editor',
          }),
        ),
      );
      expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await db.user.count({ where: { tenantId, isActive: true } })).toBe(
        3,
      );
      const inactive = await db.user.create({
        data: {
          tenantId,
          email: `${randomUUID()}@example.invalid`,
          passwordHash: 'synthetic',
          isActive: false,
        },
      });
      await expect(
        users.update({ tenantId, userId: inactive.id, isActive: true }),
      ).rejects.toMatchObject({ code: 'BILLING_QUOTA_EXCEEDED' });
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: inactive.id } }))
          .isActive,
      ).toBe(false);
    });
    test('keys count parents during rotations; webhook activations cannot exceed capacity; revocation stays available', async () => {
      await trial();
      const issued = () => ({
        publicId: randomUUID().replaceAll('-', ''),
        digest: Buffer.alloc(32).toString('hex'),
        pepperVersion: 1,
        environment: 'test' as const,
        secret: 'unused',
        raw: 'unused',
      });
      const key = await keys.create({
        tenantId,
        ownerId: actorId,
        name: 'Synthetic',
        scopes: ['testimonials:read'],
        expiresAt: null,
        issued: issued(),
      });
      await keys.rotate({
        tenantId,
        actorId,
        apiKeyId: key.id,
        name: 'Synthetic',
        scopes: ['testimonials:read'],
        expiresAt: null,
        issued: issued(),
      });
      expect((await access.usage(tenantId)).active_api_keys).toBe(1);
      await expect(
        keys.create({
          tenantId,
          ownerId: actorId,
          name: 'Another',
          scopes: ['testimonials:read'],
          expiresAt: null,
          issued: issued(),
        }),
      ).rejects.toMatchObject({ code: 'BILLING_QUOTA_EXCEEDED' });
      const make = () =>
        hooks.create({
          id: randomUUID(),
          tenantId,
          url: 'https://example.invalid/hook',
          eventCode: 'testimonial.created',
          secretCiphertext: 'synthetic',
          secretKeyVersion: 1,
          isActive: false,
        });
      const [a, b] = await Promise.all([make(), make()]);
      const changes = await Promise.allSettled([
        hooks.update(tenantId, a.id, { isActive: true }),
        hooks.update(tenantId, b.id, { isActive: true }),
      ]);
      expect(changes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      await db.billingAccessPeriod.updateMany({
        where: { tenantId },
        data: { endsAt: new Date(Date.now() - 1) },
      });
      await hooks.update(tenantId, a.id, { isActive: false });
      expect((await access.snapshot(tenantId)).access.canMutate).toBe(false);
    });
    test('technical flags cannot grant an excluded feature; enforcement opt-out and disabled mode are explicit', async () => {
      await trial();
      const name = 'enable_analytics';
      const flag = await db.featureFlag.upsert({
        where: { name },
        create: { name },
        update: {},
      });
      await db.tenantFeatureFlag.create({
        data: { tenantId, featureFlagId: flag.id, enabled: true },
      });
      const flags = new FeatureFlagRepository(
        db as unknown as PrismaService,
        access,
      );
      expect(await flags.isEnabled(tenantId, name)).toBe(false);
      await db.billingAccount.update({
        where: { tenantId },
        data: { enforcementEnabled: false },
      });
      expect(await flags.isEnabled(tenantId, name)).toBe(true);
      const noQuery = new BillingAccessRepository({} as PrismaService, {
        mode: 'disabled',
      });
      await expect(noQuery.canFeature(tenantId, 'analytics')).resolves.toBe(
        true,
      );
    });
    test('durable webhook deliveries pause without consuming retry budget and resume after eligibility returns', async () => {
      await trial();
      const hook = await hooks.create({
        id: randomUUID(),
        tenantId,
        url: 'https://example.invalid/hook',
        eventCode: 'testimonial.created',
        secretCiphertext: 'synthetic',
        secretKeyVersion: 1,
      });
      await outbox.createEvent({
        tenantId,
        eventType: 'testimonial.created',
        payload: { id: 'synthetic' },
      });
      await db.billingAccessPeriod.updateMany({
        where: { tenantId },
        data: { endsAt: new Date(Date.now() - 1) },
      });
      await outbox.refreshCommercialSuspensions();
      expect(await outbox.claimDue()).toEqual([]);
      const suspended = await db.webhookDelivery.findFirstOrThrow({
        where: { tenantId, webhookId: hook.id },
      });
      expect(suspended.status).toBe('suspended');
      expect(suspended.retryBudgetAttempts).toBe(0);
      await db.billingAccessPeriod.updateMany({
        where: { tenantId },
        data: { endsAt: new Date(Date.now() + 86400000) },
      });
      await outbox.refreshCommercialSuspensions();
      const claim = (await outbox.claimDue())[0]!;
      expect(claim.id).toBe(suspended.id);
      await db.webhookDelivery.update({
        where: { id: claim.id },
        data: { leaseUntil: new Date(0), retryBudgetStartedAt: new Date(0) },
      });
      await db.billingAccessPeriod.updateMany({
        where: { tenantId },
        data: { endsAt: new Date(Date.now() - 1) },
      });
      await outbox.refreshCommercialSuspensions();
      await outbox.recoverExpired();
      expect(
        (
          await db.webhookDelivery.findUniqueOrThrow({
            where: { id: claim.id },
          })
        ).status,
      ).toBe('suspended');
    });
    test('BI policy view exposes only minimal scoped policy and a read-only consumer has no financial-table access', async () => {
      await trial();
      const runtime = await fixture.runtimeClient();
      const role = (
        await runtime.$queryRaw<
          Array<{ name: string }>
        >`SELECT current_user AS name`
      )[0]!.name;
      await db.$executeRawUnsafe(
        `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM "${role}"`,
      );
      await db.$executeRawUnsafe(
        `GRANT USAGE ON SCHEMA bi_export TO "${role}"`,
      );
      await db.$executeRawUnsafe(
        `GRANT SELECT ON bi_export.billing_policy TO "${role}"`,
      );
      const old = process.env.BILLING_MODE;
      process.env.BILLING_MODE = 'simulation';
      try {
        const source = new SourceRepository(runtime);
        expect(await source.commercialEligibility(tenantId)).toEqual({
          bi: true,
          statistics: false,
        });
        expect(await source.commercialEligibility(randomUUID())).toEqual({
          bi: false,
          statistics: false,
        });
        await expect(
          runtime.$queryRaw`SELECT * FROM billing_payments`,
        ).rejects.toThrow();
        await expect(
          runtime.$executeRaw`DELETE FROM bi_export.billing_policy`,
        ).rejects.toThrow();
        await db.billingAccessPeriod.updateMany({
          where: { tenantId },
          data: { endsAt: new Date(Date.now() - 1) },
        });
        expect(await source.commercialEligibility(tenantId)).toEqual({
          bi: false,
          statistics: false,
        });
      } finally {
        if (old === undefined) delete process.env.BILLING_MODE;
        else process.env.BILLING_MODE = old;
      }
    });
    test('read-only access retains reads and billing but blocks CMS mutations; cookie billing still requires CSRF', async () => {
      await call('get', '/users').expect(200);
      const denied = await call('post', '/users')
        .send({
          email: `${randomUUID()}@example.invalid`,
          password: 'Synthetic-test-only-123!',
          role: 'editor',
        })
        .expect(403);
      expect(denied.body.code).toBe('BILLING_ACCESS_REQUIRED');
      await request(app.getHttpServer())
        .post('/api/v1/billing/trial')
        .set('cookie', `accessToken=${token}; refreshToken=synthetic-refresh`)
        .set('origin', 'http://localhost:3000')
        .set('idempotency-key', 'cookie-no-csrf')
        .send({ planVersionId: versionId })
        .expect(403);
      expect(await db.billingAccessPeriod.count({ where: { tenantId } })).toBe(
        0,
      );
      await trial();
      await call('get', '/users').expect(200);
    });
    test('operator HTTP edits only drafts with revision checks and enables policy through a separate DB permission', async () => {
      await operator();
      const plan = (
        await call('post', '/platform/billing/plans')
          .set('idempotency-key', 'create-plan')
          .send({ code: `synthetic-${randomUUID()}` })
          .expect(201)
      ).body.data;
      const draft = {
        name: 'Synthetic new terms',
        description: 'Only for tests',
        trialDays: 3,
        graceDays: 7,
        features: {
          media: false,
          analytics: false,
          scoring: false,
          business_intelligence: false,
          bi_statistics: false,
          api_keys: true,
          webhooks: true,
        },
        quotas: {
          active_users: 0,
          stored_testimonials: null,
          active_api_keys: 0,
          active_webhooks: 0,
        },
        prices: [
          {
            provider: 'stripe',
            currency: 'USD',
            interval: 'month',
            amountMinor: '2999',
            modes: ['manual'],
          },
        ],
      };
      const v = (
        await call('post', `/platform/billing/plans/${plan.id}/versions`)
          .set('idempotency-key', 'create-version')
          .send(draft)
          .expect(201)
      ).body.data;
      await call('post', `/platform/billing/versions/${v.id}/publish`)
        .set('idempotency-key', 'publish')
        .send({ expectedRevision: Number(v.revision) })
        .expect(202);
      await call('patch', `/platform/billing/versions/${v.id}`)
        .set('idempotency-key', 'illegal-edit')
        .send({
          expectedRevision: Number(v.revision) + 1,
          draft: { ...draft, name: 'Overwritten' },
        })
        .expect(409);
      expect(
        (await db.billingPlanVersion.findUniqueOrThrow({ where: { id: v.id } }))
          .name,
      ).toBe(draft.name);
      await call('patch', `/platform/billing/tenants/${tenantId}/policy`)
        .set('idempotency-key', 'policy')
        .send({ expectedRevision: 99, enforcementEnabled: false })
        .expect(409);
      await call('patch', `/platform/billing/tenants/${tenantId}/policy`)
        .set('idempotency-key', 'policy-ok')
        .send({ expectedRevision: 0, enforcementEnabled: false })
        .expect(202);
      expect((await access.snapshot(tenantId)).enforcementEnabled).toBe(false);
    });
    test('change waits for the paid horizon and confirmed old cancellation before a new adhesion', async () => {
      await operator();
      const id = await checkout('automatic');
      await call('post', `/platform/billing/operations/${id}/simulate`)
        .set('idempotency-key', 'initial-paid')
        .send({
          scenario: 'approved',
          at: new Date().toISOString(),
          cycle: 'initial',
        })
        .expect(202);
      const sub = await db.billingSubscription.findFirstOrThrow({
          where: { tenantId },
        }),
        oldEnd = sub.paidThrough!;
      const change = (
        await call('post', '/billing/subscription/changes')
          .set('idempotency-key', 'change-to-manual')
          .send({ priceId, mode: 'manual' })
          .expect(202)
      ).body.data;
      expect(new Date(change.effectiveAt).toISOString()).toBe(
        oldEnd.toISOString(),
      );
      await call('post', '/billing/checkouts')
        .set('idempotency-key', 'too-soon')
        .send({ priceId, mode: 'manual' })
        .expect(409);
      await processor.tick([accountId]);
      expect(
        (
          await db.billingSubscription.findUniqueOrThrow({
            where: { id: sub.id },
          })
        ).status,
      ).toBe('canceled');
      expect((await access.snapshot(tenantId)).access.mode).toBe('paid');
      expect(
        (
          await db.billingAccessPeriod.findFirstOrThrow({
            where: { tenantId, kind: 'paid' },
          })
        ).endsAt.toISOString(),
      ).toBe(oldEnd.toISOString());
      expect(
        await db.billingSubscription.count({
          where: { tenantId, status: { not: 'canceled' } },
        }),
      ).toBe(0);
    });

    test('a return after a total refund reports reversed access instead of a current confirmation', async () => {
      await operator();
      const id = await checkout();
      const at = new Date();
      for (const [scenario, offset] of [
        ['approved', 0],
        ['full_refund', 1000],
      ] as const) {
        await call('post', `/platform/billing/operations/${id}/simulate`)
          .set('idempotency-key', randomUUID())
          .send({
            scenario,
            at: new Date(at.getTime() + offset).toISOString(),
            cycle: 'initial',
          })
          .expect(202);
      }
      const operation = (
        await call('get', `/billing/operations/${id}`).expect(200)
      ).body.data;
      expect(operation.paymentStatus).toBe('reversed');
      expect(operation.redirectUrl).toBeUndefined();
      expect((await access.snapshot(tenantId)).access.canMutate).toBe(false);
    });
  },
);
