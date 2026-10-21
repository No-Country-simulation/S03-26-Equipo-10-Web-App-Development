import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../src/modules/database/prisma.service';
import { BillingOperatorRepository } from '../src/modules/billing/repositories/billing-operator.repository';
import { BillingCatalogRepository } from '../src/modules/billing/repositories/billing-catalog.repository';
import { BillingTenantRepository } from '../src/modules/billing/repositories/billing-tenant.repository';
import { BillingSettlementRepository } from '../src/modules/billing/repositories/billing-settlement.repository';
import type { PaymentObservation } from '../src/modules/billing/domain/billing.types';
import { UserRepository } from '../src/modules/users/repositories/user.repository';
import { IdempotencyRepository } from '../src/common/repositories/idempotency.repository';
import { createBillingDatabase } from './fixtures/billing-postgres';
import type { PlanVersionDraft } from '../src/modules/billing/contracts/billing.schemas';

const parentUrl =
  process.env.TEST_BILLING_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
const describeDatabase = parentUrl ? describe : describe.skip;
export const syntheticPlan = (): PlanVersionDraft => ({
  name: 'Plan sintético',
  description: '',
  trialDays: 14,
  graceDays: 7,
  features: {
    media: true,
    analytics: true,
    scoring: true,
    business_intelligence: true,
    bi_statistics: true,
    api_keys: true,
    webhooks: true,
  },
  quotas: {
    active_users: 2,
    stored_testimonials: 5,
    active_api_keys: 1,
    active_webhooks: 1,
  },
  prices: [
    {
      provider: 'stripe',
      currency: 'USD',
      interval: 'month',
      amountMinor: '1999',
      modes: ['manual', 'automatic'],
    },
  ],
});

describeDatabase(
  'billing PostgreSQL persistence and operator permissions',
  () => {
    let fixture: Awaited<ReturnType<typeof createBillingDatabase>>;
    let db: PrismaClient;
    let operator: BillingOperatorRepository;
    let catalog: BillingCatalogRepository;
    let tenants: BillingTenantRepository;
    let actor: string;
    let tenantId: string;
    let userId: string;
    let sellerId: string;
    let payments: BillingSettlementRepository;
    beforeAll(async () => {
      fixture = await createBillingDatabase(parentUrl!);
      db = fixture.prisma;
      const prisma = db as unknown as PrismaService;
      operator = new BillingOperatorRepository(prisma);
      catalog = new BillingCatalogRepository(prisma);
      tenants = new BillingTenantRepository(prisma);
      payments = new BillingSettlementRepository(prisma);
      sellerId = (
        await db.billingProviderAccount.create({
          data: {
            provider: 'stripe',
            environment: 'sandbox',
            sellerId: 'synthetic-seller',
            configurationKey: 'BILLING_STRIPE_TEST',
            enabled: true,
          },
        })
      ).id;
      const tenant = await db.tenant.create({
        data: { name: `Synthetic operator ${randomUUID()}` },
      });
      actor = (
        await db.user.create({
          data: {
            tenantId: tenant.id,
            email: `${randomUUID()}@example.invalid`,
            passwordHash: 'non-authenticatable-synthetic-hash',
          },
        })
      ).id;
      await operator.setMembership(actor, true);
    }, 90000);
    beforeEach(async () => {
      tenantId = (
        await db.tenant.create({
          data: { name: `Synthetic tenant ${randomUUID()}` },
        })
      ).id;
      userId = (
        await db.user.create({
          data: {
            tenantId,
            email: `${randomUUID()}@example.invalid`,
            passwordHash: 'non-authenticatable-synthetic-hash',
          },
        })
      ).id;
    });
    afterAll(async () => {
      await fixture?.close();
    });

    async function version(input = syntheticPlan()) {
      const plan = await catalog.createPlan(actor, `plan-${randomUUID()}`);
      return catalog.createVersion(actor, plan.id, input);
    }

    it('serializes a concurrent operator grant with a tenant activation change', async () => {
      const users = new UserRepository(db as unknown as PrismaService);
      const results = await Promise.allSettled([
        operator.setMembership(userId, true),
        users.update({ tenantId, userId, isActive: false }),
      ]);
      expect(
        results.filter((r) => r.status === 'fulfilled').length,
      ).toBeGreaterThan(0);
      const active = (
        await db.user.findUniqueOrThrow({ where: { id: userId } })
      ).isActive;
      const membership = await operator.isOperator(userId);
      expect(membership && !active).toBe(false);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    });

    it('enforces zero testimonial/webhook capacity while keeping the unlimited user quota', async () => {
      const input = syntheticPlan();
      input.quotas = {
        ...input.quotas,
        active_users: null,
        stored_testimonials: 0,
        active_webhooks: 0,
      };
      const draft = await version(input);
      await catalog.publish(actor, draft.id, 0n);
      await tenants.startTrial(tenantId, 'sandbox', draft.id);
      await tenants.setPolicy(actor, tenantId, 0n, true);
      await expect(
        tenants.withQuota(
          tenantId,
          'sandbox',
          'stored_testimonials',
          1,
          async () => true,
        ),
      ).rejects.toMatchObject({ code: 'BILLING_QUOTA_EXCEEDED' });
      await expect(
        tenants.withQuota(
          tenantId,
          'sandbox',
          'active_webhooks',
          1,
          async () => true,
        ),
      ).rejects.toMatchObject({ code: 'BILLING_QUOTA_EXCEEDED' });
      await tenants.withQuota(tenantId, 'sandbox', 'active_users', 1, (tx) =>
        tx.user.create({
          data: {
            tenantId,
            email: `${randomUUID()}@example.invalid`,
            passwordHash: 'non-authenticatable-synthetic-hash',
          },
        }),
      );
      expect(await db.user.count({ where: { tenantId, isActive: true } })).toBe(
        2,
      );
    });

    it('counts logical API keys once and releases capacity for revoked or expired keys', async () => {
      const draft = await version();
      await catalog.publish(actor, draft.id, 0n);
      await tenants.startTrial(tenantId, 'sandbox', draft.id);
      await tenants.setPolicy(actor, tenantId, 0n, true);
      const create = () =>
        tenants.withQuota(tenantId, 'sandbox', 'active_api_keys', 1, (tx) =>
          tx.apiKey.create({ data: { tenantId, name: 'Synthetic key' } }),
        );
      const first = await create();
      await expect(create()).rejects.toMatchObject({
        code: 'BILLING_QUOTA_EXCEEDED',
      });
      await db.apiKey.update({
        where: { id: first.id },
        data: { isActive: false, status: 'REVOKED', revokedAt: new Date() },
      });
      const second = await create();
      await db.apiKey.update({
        where: { id: second.id },
        data: { expiresAt: new Date(0) },
      });
      const third = await create();
      expect(third.id).not.toBe(first.id);
    });

    it('archiving prevents new contracts but preserves renewal terms already accepted', async () => {
      const { draft, price, observation } = await purchase();
      await payments.recordObservation(tenantId, 'sandbox', observation, {
        providerStatus: 'paid',
      });
      await catalog.archive(actor, draft.id, 1n);
      await expect(
        tenants.startTrial(tenantId, 'live', draft.id),
      ).rejects.toMatchObject({ code: 'BILLING_PLAN_UNAVAILABLE' });
      const renewal = await payments.preparePurchase({
        tenantId,
        environment: 'sandbox',
        priceId: price.id,
        mode: 'manual',
        cycleKey: randomUUID(),
      });
      expect(renewal.amountMinor).toBe(1999n);
      const other = (
        await db.tenant.create({ data: { name: `Other ${randomUUID()}` } })
      ).id;
      await expect(
        payments.preparePurchase({
          tenantId: other,
          environment: 'sandbox',
          priceId: price.id,
          mode: 'manual',
          cycleKey: randomUUID(),
        }),
      ).rejects.toMatchObject({ code: 'BILLING_PLAN_UNAVAILABLE' });
    });

    async function offer() {
      const draft = await version();
      await catalog.publish(actor, draft.id, 0n);
      const price = await db.billingPrice.findFirstOrThrow({
        where: { planVersionId: draft.id },
      });
      await db.billingPriceBinding.create({
        data: {
          priceId: price.id,
          planVersionId: draft.id,
          provider: 'stripe',
          providerAccountId: sellerId,
          environment: 'sandbox',
          status: 'ready',
        },
      });
      return { draft, price };
    }
    async function purchase(mode: 'manual' | 'automatic' = 'manual') {
      const item = await offer();
      const obligation = await payments.preparePurchase({
        tenantId,
        environment: 'sandbox',
        priceId: item.price.id,
        mode,
        cycleKey: randomUUID(),
      });
      const order = await db.billingOrder.findUniqueOrThrow({
        where: { id: obligation.orderId },
      });
      const observation: PaymentObservation = {
        tenantId,
        environment: 'sandbox',
        provider: 'stripe',
        accountId: sellerId,
        obligationId: obligation.id,
        externalReference: order.externalReference,
        money: { amountMinor: 1999n, currency: 'USD' },
        paymentId: `synthetic-payment-${randomUUID()}`,
        status: 'succeeded',
        refundedMinor: 0n,
        chargedBack: false,
      };
      return { ...item, obligation, observation };
    }

    it('denies platform catalog writes to a tenant administrator without operator membership', async () => {
      await expect(
        catalog.createPlan(userId, 'unauthorized'),
      ).rejects.toMatchObject({ code: 'BILLING_OPERATOR_REQUIRED' });
      expect(await operator.isOperator(userId)).toBe(false);
    });
    it('protects an operator from password/status changes through the tenant repository', async () => {
      await operator.setMembership(userId, true);
      const users = new UserRepository(db as unknown as PrismaService);
      await expect(
        users.update({
          tenantId,
          userId,
          passwordHash: 'changed-invalid-hash',
          isActive: false,
        }),
      ).rejects.toMatchObject({ code: 'BILLING_OPERATOR_PROTECTED' });
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: userId } })).isActive,
      ).toBe(true);
    });
    it('retains protection after revocation and forbids deleting operator history', async () => {
      await operator.setMembership(userId, true);
      await operator.setMembership(userId, false);
      expect(await operator.isOperator(userId)).toBe(false);
      const users = new UserRepository(db as unknown as PrismaService);
      await expect(
        users.update({ tenantId, userId, isActive: false }),
      ).rejects.toMatchObject({ code: 'BILLING_OPERATOR_PROTECTED' });
      await expect(users.remove(tenantId, userId)).rejects.toMatchObject({
        code: 'BILLING_OPERATOR_PROTECTED',
      });
      await expect(
        db.billingPlatformOperator.delete({ where: { userId } }),
      ).rejects.toThrow();
    });
    it('checks active membership on each call and does not mistake tenant admin role for operator', async () => {
      await operator.setMembership(userId, true);
      expect(await operator.isOperator(userId)).toBe(true);
      await operator.setMembership(userId, false);
      await expect(catalog.createPlan(userId, 'revoked')).rejects.toMatchObject(
        { code: 'BILLING_OPERATOR_REQUIRED' },
      );
      await operator.setMembership(userId, true);
      await db.tenant.update({
        where: { id: tenantId },
        data: { isActive: false },
      });
      expect(await operator.isOperator(userId)).toBe(false);
    });
    it('uses draft revisions and makes published prices/terms immutable even through direct SQL', async () => {
      const draft = await version();
      await catalog.editDraft(actor, draft.id, 0n, {
        ...syntheticPlan(),
        name: 'Segunda revisión',
      });
      await expect(
        catalog.editDraft(actor, draft.id, 0n, syntheticPlan()),
      ).rejects.toMatchObject({ code: 'BILLING_VERSION_CONFLICT' });
      await catalog.publish(actor, draft.id, 1n);
      await expect(
        catalog.editDraft(actor, draft.id, 2n, syntheticPlan()),
      ).rejects.toMatchObject({ code: 'BILLING_VERSION_CONFLICT' });
      await expect(
        db.billingPlanVersion.update({
          where: { id: draft.id },
          data: { name: 'Bypass' },
        }),
      ).rejects.toThrow();
      await expect(
        db.billingPrice.updateMany({
          where: { planVersionId: draft.id },
          data: { amountMinor: 1n },
        }),
      ).rejects.toThrow();
      const revised = await catalog.createVersion(
        actor,
        draft.planId,
        syntheticPlan(),
      );
      expect(revised.version).toBe(2);
    });
    it('starts only one trial under concurrency and never renews it across environments', async () => {
      const draft = await version();
      await catalog.publish(actor, draft.id, 0n);
      const results = await Promise.allSettled([
        tenants.startTrial(tenantId, 'sandbox', draft.id),
        tenants.startTrial(tenantId, 'live', draft.id),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await db.billingAccessPeriod.count({ where: { tenantId } })).toBe(
        1,
      );
      expect(
        (await db.billingAccount.findUniqueOrThrow({ where: { tenantId } }))
          .trialConsumedAt,
      ).not.toBeNull();
    });
    it('commits a local trial and its idempotency receipt together, then replays the same grant', async () => {
      const draft = await version();
      await catalog.publish(actor, draft.id, 0n);
      const idempotency = new IdempotencyRepository(
        db as unknown as PrismaService,
      );
      const request = {
        key: randomUUID(),
        tenantId,
        principalKind: 'user' as const,
        principalId: userId,
        method: 'POST' as const,
        path: '/billing/trial',
        payload: { planVersionId: draft.id },
        statusCode: 201 as const,
      };
      const begin = () =>
        idempotency.execute(request, (tx) =>
          tenants.startTrial(tenantId, 'sandbox', draft.id, new Date(), tx),
        );
      const [first, second] = await Promise.all([begin(), begin()]);
      expect(first.value.id).toBe(second.value.id);
      expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
      expect(await db.billingAccessPeriod.count({ where: { tenantId } })).toBe(
        1,
      );
    });
    it('serializes capacity check and mutation, rolling back failed writes', async () => {
      const draft = await version();
      await catalog.publish(actor, draft.id, 0n);
      await tenants.startTrial(tenantId, 'sandbox', draft.id);
      await tenants.setPolicy(actor, tenantId, 0n, true);
      const add = () =>
        tenants.withQuota(tenantId, 'sandbox', 'active_users', 1, (tx) =>
          tx.user.create({
            data: {
              tenantId,
              email: `${randomUUID()}@example.invalid`,
              passwordHash: 'non-authenticatable-synthetic-hash',
            },
          }),
        );
      const results = await Promise.allSettled([add(), add()]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(await db.user.count({ where: { tenantId, isActive: true } })).toBe(
        2,
      );
      await expect(
        tenants.withQuota(
          tenantId,
          'sandbox',
          'active_users',
          0,
          async (tx) => {
            await tx.user.update({
              where: { id: userId },
              data: { isActive: false },
            });
            throw new Error('synthetic-rollback');
          },
        ),
      ).rejects.toThrow('synthetic-rollback');
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: userId } })).isActive,
      ).toBe(true);
      await expect(
        tenants.withQuota(
          tenantId,
          'live',
          'active_users',
          1,
          async () => true,
        ),
      ).rejects.toMatchObject({ code: 'BILLING_ACCESS_REQUIRED' });
    });
    it('restores schema, triggers, trial and audit to a different owned database', async () => {
      const draft = await version();
      await catalog.publish(actor, draft.id, 0n);
      await tenants.startTrial(tenantId, 'sandbox', draft.id);
      const restored = await fixture.restoredClient();
      expect(
        await restored.billingAccessPeriod.count({ where: { tenantId } }),
      ).toBe(1);
      expect(
        await restored.billingAudit.count({
          where: { tenantId, action: 'trial.started' },
        }),
      ).toBe(1);
      await expect(
        restored.billingPlanVersion.update({
          where: { id: draft.id },
          data: { trialDays: 20 },
        }),
      ).rejects.toThrow();
    }, 60000);
    it('runtime credentials can read membership but cannot grant it or perform DDL', async () => {
      const runtime = await fixture.runtimeClient();
      expect(
        await new BillingOperatorRepository(
          runtime as unknown as PrismaService,
        ).isOperator(actor),
      ).toBe(true);
      await expect(
        new BillingOperatorRepository(
          runtime as unknown as PrismaService,
        ).setMembership(userId, true),
      ).rejects.toThrow();
      await expect(
        runtime.$executeRawUnsafe(
          'CREATE TABLE billing_forbidden_ddl (id integer)',
        ),
      ).rejects.toThrow();
      expect(
        await db.billingPlatformOperator.findUnique({ where: { userId } }),
      ).toBeNull();
    });

    it('persists the server price and replays one purchase intent without another obligation', async () => {
      const { price } = await offer();
      const cycleKey = randomUUID();
      const input = {
        tenantId,
        environment: 'sandbox' as const,
        priceId: price.id,
        mode: 'manual' as const,
        cycleKey,
      };
      const [first, replay] = await Promise.all([
        payments.preparePurchase(input),
        payments.preparePurchase(input),
      ]);
      expect(first.id).toBe(replay.id);
      expect(first.amountMinor).toBe(1999n);
      expect(await db.billingObligation.count({ where: { tenantId } })).toBe(1);
      await expect(
        payments.preparePurchase({ ...input, cycleKey: randomUUID() }),
      ).rejects.toMatchObject({ code: 'BILLING_PAYMENT_PENDING' });
    });
    it('credits one grant and ends the trial atomically under duplicate financial observations', async () => {
      const { draft, obligation, observation } = await purchase();
      await tenants.startTrial(tenantId, 'sandbox', draft.id);
      const results = await Promise.all([
        payments.recordObservation(tenantId, 'sandbox', observation, {
          providerStatus: 'paid',
        }),
        payments.recordObservation(tenantId, 'sandbox', observation, {
          providerStatus: 'paid',
        }),
      ]);
      expect(results.map((r) => r.accessEffect).sort()).toEqual([
        'grant',
        'none',
      ]);
      expect(await db.billingPayment.count({ where: { tenantId } })).toBe(1);
      expect(
        await db.billingAccessPeriod.count({
          where: { tenantId, kind: 'paid' },
        }),
      ).toBe(1);
      expect(
        (
          await db.billingAccessPeriod.findFirstOrThrow({
            where: { tenantId, kind: 'trial' },
          })
        ).revokedAt,
      ).not.toBeNull();
      expect(
        (
          await db.billingObligation.findUniqueOrThrow({
            where: { id: obligation.id },
          })
        ).status,
      ).toBe('paid');
    });
    it('rejects a mismatched amount without persisting a payment or granting access', async () => {
      const { observation } = await purchase();
      await expect(
        payments.recordObservation(
          tenantId,
          'sandbox',
          { ...observation, money: { amountMinor: 1n, currency: 'USD' } },
          { providerStatus: 'paid' },
        ),
      ).rejects.toMatchObject({ code: 'BILLING_PAYMENT_MISMATCH' });
      expect(await db.billingPayment.count({ where: { tenantId } })).toBe(0);
      expect(
        await db.billingAccessPeriod.count({
          where: { tenantId, kind: 'paid' },
        }),
      ).toBe(0);
    });
    it('rejects another tenant and an environment mismatch before financial effects', async () => {
      const { observation } = await purchase();
      const other = (
        await db.tenant.create({ data: { name: `Other ${randomUUID()}` } })
      ).id;
      await expect(
        payments.recordObservation(other, 'sandbox', observation, {
          providerStatus: 'paid',
        }),
      ).rejects.toMatchObject({ code: 'BILLING_OBLIGATION_NOT_FOUND' });
      await expect(
        payments.recordObservation(tenantId, 'live', observation, {
          providerStatus: 'paid',
        }),
      ).rejects.toMatchObject({ code: 'BILLING_OBLIGATION_NOT_FOUND' });
      expect(await db.billingPayment.count({ where: { tenantId } })).toBe(0);
    });
    it('revokes only the credited period on full refund and never restores it on a stale success', async () => {
      const { observation, obligation } = await purchase();
      await payments.recordObservation(tenantId, 'sandbox', observation, {
        providerStatus: 'paid',
      });
      await payments.recordObservation(
        tenantId,
        'sandbox',
        { ...observation, refundedMinor: 999n },
        { providerStatus: 'partial_refund' },
      );
      expect(
        (
          await db.billingAccessPeriod.findFirstOrThrow({
            where: { obligationId: obligation.id },
          })
        ).revokedAt,
      ).toBeNull();
      const full = await payments.recordObservation(
        tenantId,
        'sandbox',
        { ...observation, refundedMinor: 1999n },
        { providerStatus: 'refunded' },
      );
      expect(full.accessEffect).toBe('revoke');
      const stale = await payments.recordObservation(
        tenantId,
        'sandbox',
        observation,
        { providerStatus: 'paid' },
      );
      expect(stale.payment.status).toBe('refunded');
      expect(stale.accessEffect).toBe('none');
      expect(
        (
          await db.billingSubscription.findUniqueOrThrow({
            where: { id: obligation.subscriptionId },
          })
        ).paidThrough,
      ).toBeNull();
    });
    it('records an additional payment and refund without granting or revoking another payment period', async () => {
      const { observation, obligation } = await purchase();
      await payments.recordObservation(tenantId, 'sandbox', observation, {
        providerStatus: 'paid',
      });
      const second = {
        ...observation,
        paymentId: `synthetic-extra-${randomUUID()}`,
      };
      const result = await payments.recordObservation(
        tenantId,
        'sandbox',
        second,
        { providerStatus: 'paid' },
      );
      expect(result).toMatchObject({
        accessEffect: 'none',
        discrepancy: 'additional_payment',
      });
      await payments.recordObservation(
        tenantId,
        'sandbox',
        { ...second, refundedMinor: 1999n },
        { providerStatus: 'refunded' },
      );
      expect(
        await db.billingAccessPeriod.count({
          where: { obligationId: obligation.id },
        }),
      ).toBe(1);
      expect(
        (
          await db.billingAccessPeriod.findFirstOrThrow({
            where: { obligationId: obligation.id },
          })
        ).revokedAt,
      ).toBeNull();
    });
    it('rolls back payment and credit when an automatic renewal lacks a verified period', async () => {
      const { observation, obligation } = await purchase('automatic');
      await expect(
        payments.recordObservation(tenantId, 'sandbox', observation, {
          providerStatus: 'paid',
        }),
      ).rejects.toMatchObject({ code: 'BILLING_PERIOD_INVALID' });
      expect(await db.billingPayment.count({ where: { tenantId } })).toBe(0);
      expect(
        (
          await db.billingObligation.findUniqueOrThrow({
            where: { id: obligation.id },
          })
        ).creditedPaymentId,
      ).toBeNull();
      const period = {
        startsAt: new Date('2026-01-31T12:00:00Z'),
        endsAt: new Date('2026-02-28T12:00:00Z'),
      };
      await payments.recordObservation(tenantId, 'sandbox', observation, {
        providerStatus: 'paid',
        recurringPeriod: period,
      });
      expect(
        (
          await db.billingAccessPeriod.findFirstOrThrow({
            where: { obligationId: obligation.id },
          })
        ).endsAt,
      ).toEqual(period.endsAt);
    });
    it('database constraints reject another tenant payment and an obligation amount mismatch', async () => {
      const { obligation } = await purchase();
      const other = (
        await db.tenant.create({ data: { name: `Other ${randomUUID()}` } })
      ).id;
      const data = {
        tenantId,
        environment: 'sandbox',
        obligationId: obligation.id,
        providerAccountId: sellerId,
        externalPaymentId: `synthetic-${randomUUID()}`,
        amountMinor: 1999n,
        currency: 'USD',
        status: 'pending',
        providerStatus: 'pending',
        observedAt: new Date(),
      };
      await expect(
        db.billingPayment.create({ data: { ...data, tenantId: other } }),
      ).rejects.toThrow();
      await expect(
        db.billingPayment.create({ data: { ...data, amountMinor: 1n } }),
      ).rejects.toThrow();
      await expect(
        db.billingPayment.create({ data: { ...data, refundedMinor: 2000n } }),
      ).rejects.toThrow();
      await expect(
        db.billingSubscription.create({
          data: {
            ...(await db.billingSubscription.findUniqueOrThrow({
              where: { id: obligation.subscriptionId },
            })),
            id: randomUUID(),
          },
        }),
      ).rejects.toThrow();
    });
    it('deduplicates event identity without suppressing a later event for the same resource', async () => {
      const event = {
        providerAccountId: sellerId,
        environment: 'sandbox',
        eventKey: randomUUID(),
        topic: 'payment',
        resourceId: randomUUID(),
      };
      await db.billingWebhookInbox.create({ data: event });
      await expect(
        db.billingWebhookInbox.create({ data: event }),
      ).rejects.toThrow();
      await db.billingWebhookInbox.create({
        data: { ...event, eventKey: randomUUID() },
      });
      expect(
        await db.billingWebhookInbox.count({
          where: { resourceId: event.resourceId },
        }),
      ).toBe(2);
      await expect(
        db.billingWebhookInbox.create({
          data: { ...event, eventKey: randomUUID(), status: 'processing' },
        }),
      ).rejects.toThrow();
    });
    it('restores a credited payment, its unique grant and compound references', async () => {
      const { observation, obligation } = await purchase();
      await payments.recordObservation(tenantId, 'sandbox', observation, {
        providerStatus: 'paid',
      });
      const restored = await fixture.restoredClient();
      const row = await restored.billingObligation.findUniqueOrThrow({
        where: { id: obligation.id },
      });
      expect(row.status).toBe('paid');
      expect(row.creditedPaymentId).not.toBeNull();
      expect(
        (
          await restored.billingAccessPeriod.findFirstOrThrow({
            where: { obligationId: obligation.id },
          })
        ).paymentId,
      ).toBe(row.creditedPaymentId);
      await expect(
        restored.billingAccessPeriod.create({
          data: {
            tenantId,
            environment: 'sandbox',
            planVersionId: (
              await restored.billingAccessPeriod.findFirstOrThrow({
                where: { obligationId: obligation.id },
              })
            ).planVersionId,
            kind: 'paid',
            obligationId: obligation.id,
            paymentId: row.creditedPaymentId,
            startsAt: new Date('2026-01-01Z'),
            endsAt: new Date('2026-02-01Z'),
          },
        }),
      ).rejects.toThrow();
    }, 60000);
  },
);
