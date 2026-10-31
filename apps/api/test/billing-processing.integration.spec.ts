import { runBillingWorker } from '../src/modules/billing/worker.cli';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import Stripe from 'stripe';
import request from 'supertest';
import type { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../src/modules/database/prisma.service';
import { createBillingDatabase } from './fixtures/billing-postgres';
import { BillingLedgerRepository } from '../src/modules/billing/repositories/billing-ledger.repository';
import { BillingSettlementRepository } from '../src/modules/billing/repositories/billing-settlement.repository';
import { BillingGateways } from '../src/modules/billing/services/billing-gateways.service';
import { runSimulation } from '../src/modules/billing/simulation.cli';
import { BillingOperatorRepository } from '../src/modules/billing/repositories/billing-operator.repository';
import { BillingProcessor } from '../src/modules/billing/services/billing-processor.service';
import { BillingWebhooksController } from '../src/modules/billing/controllers/billing-webhooks.controller';
import { SimulationGateway } from '../src/modules/billing/integrations/simulation.gateway';
import { CsrfGuard } from '../src/common/guards/csrf.guard';
import { ConfigService } from '@nestjs/config';
import { SessionCsrfService } from '../src/common/services/session-csrf.service';
import { boundedJsonBody } from '../src/common/middleware/body-limits.middleware';
import type { CheckoutCommand } from '../src/modules/billing/ports/financial-gateway.port';

const parent =
  process.env.TEST_BILLING_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
const describeDb = parent ? describe : describe.skip;
const secret = 'synthetic-only-webhook-verification-key';
const simulationKey = 'synthetic-only-simulation-signing-key';
describeDb(
  'financial ledger: PostgreSQL, worker recovery and HTTP authentication',
  () => {
    let fixture: Awaited<ReturnType<typeof createBillingDatabase>>;
    let db: PrismaClient;
    let ledger: BillingLedgerRepository;
    let settlements: BillingSettlementRepository;
    let accountId: string;
    let priceId: string;
    let tenantId: string;
    let processor: BillingProcessor;
    let gateways: BillingGateways;
    let app: INestApplication;
    const simulator = new SimulationGateway(
      simulationKey,
      'http://localhost:3000/admin/billing/return',
    );
    beforeAll(async () => {
      fixture = await createBillingDatabase(parent!);
      db = fixture.prisma;
      const prisma = db as unknown as PrismaService;
      settlements = new BillingSettlementRepository(prisma);
      ledger = new BillingLedgerRepository(prisma, settlements);
      accountId = (
        await db.billingProviderAccount.create({
          data: {
            provider: 'stripe',
            environment: 'sandbox',
            sellerId: 'acct_synthetic',
            configurationKey: 'BILLING_SIMULATION',
            enabled: true,
          },
        })
      ).id;
      const plan = await db.billingPlan.create({
        data: { code: 'synthetic-processing' },
      });
      const version = await db.billingPlanVersion.create({
        data: {
          planId: plan.id,
          version: 1,
          name: 'Synthetic processing',
          status: 'draft',
          media: false,
          analytics: false,
          scoring: false,
          businessIntelligence: false,
          biStatistics: false,
          apiKeys: false,
          webhooks: false,
        },
      });
      const price = await db.billingPrice.create({
        data: {
          planVersionId: version.id,
          provider: 'stripe',
          currency: 'USD',
          interval: 'month',
          amountMinor: 1999n,
          manualEnabled: true,
          automaticEnabled: true,
        },
      });
      priceId = price.id;
      await db.billingPlanVersion.update({
        where: { id: version.id },
        data: { status: 'published', publishedAt: new Date() },
      });
      await db.billingPriceBinding.create({
        data: {
          priceId,
          planVersionId: version.id,
          providerAccountId: accountId,
          provider: 'stripe',
          environment: 'sandbox',
          status: 'ready',
        },
      });
      gateways = new BillingGateways(
        {
          mode: 'simulation',
          returnUrl: 'http://localhost:3000/return',
          simulationKey,
        },
        ledger,
      );
      processor = new BillingProcessor(ledger, gateways);
      const webhookGateways = new BillingGateways(
        {
          mode: 'sandbox',
          returnUrl: 'https://example.invalid/return',
          notificationUrl: 'https://example.invalid/notify',
          stripe: {
            accountId,
            sellerId: 'acct_synthetic',
            credential: 'sk_test_synthetic',
            webhookSecrets: [secret],
            resourceLiveMode: false,
          },
          mercadopago: {
            accountId,
            sellerId: '123',
            credential: 'synthetic',
            webhookSecrets: [secret],
            resourceLiveMode: false,
          },
          mpSignatureToleranceSeconds: 900,
        },
        ledger,
      );
      const module = await Test.createTestingModule({
        controllers: [BillingWebhooksController],
        providers: [
          { provide: BillingGateways, useValue: webhookGateways },
          { provide: BillingLedgerRepository, useValue: ledger },
          { provide: APP_GUARD, useClass: CsrfGuard },
          {
            provide: ConfigService,
            useValue: {
              getOrThrow: () => ({ corsOrigin: 'http://localhost:3000' }),
            },
          },
          { provide: SessionCsrfService, useValue: { verify: () => false } },
        ],
      }).compile();
      app = module.createNestApplication({ bodyParser: false });
      app.setGlobalPrefix('api/v1');
      app.use(boundedJsonBody);
      await app.init();
    }, 90000);
    beforeEach(async () => {
      await db.billingOperation.deleteMany();
      await db.billingWebhookInbox.deleteMany();
      tenantId = (
        await db.tenant.create({ data: { name: `Synthetic ${randomUUID()}` } })
      ).id;
    });
    afterAll(async () => {
      await app?.close();
      await fixture?.close();
    }, 30000);
    async function purchase(mode: 'manual' | 'automatic' = 'manual') {
      const obligation = await settlements.preparePurchase({
        tenantId,
        environment: 'sandbox',
        priceId,
        mode,
        cycleKey: randomUUID(),
      });
      const operation = await ledger.enqueueCheckout(
        tenantId,
        'sandbox',
        obligation.id,
        'checkout-key',
      );
      const job = await ledger.claim([accountId], 'operation');
      expect(job?.row.id).toBe(operation.id);
      if (!job || job.kind !== 'operation') throw Error('claim missing');
      const command = await ledger.command(job);
      return { obligation, operation, job, command };
    }
    async function notify(
      c: CheckoutCommand,
      scenario: Parameters<SimulationGateway['observation']>[1],
      cycle = 'initial',
    ) {
      const resourceId = simulator.observation(
        c,
        scenario,
        new Date('2026-10-20T00:00:00Z'),
        cycle,
      );
      await ledger.receive(accountId, 'sandbox', {
        topic: 'simulation',
        resourceId,
        eventKey: createHash('sha256').update(resourceId).digest('hex'),
      });
      const job = await ledger.claim([accountId], 'inbox');
      if (!job)
        return {
          kind: 'inbox' as const,
          row: await db.billingWebhookInbox.findUniqueOrThrow({
            where: {
              providerAccountId_eventKey: {
                providerAccountId: accountId,
                eventKey: createHash('sha256').update(resourceId).digest('hex'),
              },
            },
          }),
        };
      await processor.process(job);
      return job;
    }
    async function expiry(
      command: CheckoutCommand,
      operationId: string,
      overrides: Partial<
        import('../src/modules/billing/ports/financial-gateway.port').VerifiedCheckoutExpiration
      > = {},
    ) {
      await ledger.receive(accountId, 'sandbox', {
        eventKey: randomUUID(),
        topic: 'checkout.session.expired',
        resourceId: 'cs_expired',
      });
      const job = await ledger.claim([accountId], 'inbox');
      if (!job) throw Error('expiration inbox missing');
      const snapshot = {
        payments: [],
        checkoutExpiration: {
          checkoutId: `sim_${command.reference}`,
          reference: command.reference,
          operationId,
          tenantId: command.tenantId,
          localSubscriptionId: command.subscriptionId,
          money: command.money,
          ...overrides,
        },
      };
      return { job, snapshot };
    }
    test('concurrent idempotent enqueue and exclusive claim survive replay', async () => {
      const obligation = await settlements.preparePurchase({
        tenantId,
        environment: 'sandbox',
        priceId,
        mode: 'manual',
        cycleKey: 'one',
      });
      const ops = await Promise.all(
        Array.from({ length: 8 }, () =>
          ledger.enqueueCheckout(
            tenantId,
            'sandbox',
            obligation.id,
            'same-key',
          ),
        ),
      );
      expect(new Set(ops.map((o) => o.id)).size).toBe(1);
      const claims = await Promise.all(
        Array.from({ length: 8 }, () => ledger.claim([accountId], 'operation')),
      );
      expect(claims.filter(Boolean)).toHaveLength(1);
      await expect(
        ledger.enqueueCheckout(
          tenantId,
          'sandbox',
          obligation.id,
          'another-key',
        ),
      ).rejects.toThrow('BILLING_CHECKOUT_ALREADY_REQUESTED');
    });
    test('lease expiry fences stale publication and another process recovers uncertainty', async () => {
      const { job } = await purchase();
      await ledger.markCheckoutSubmitted(job);
      await db.billingOperation.update({
        where: { id: job.row.id },
        data: { leaseUntil: new Date(0) },
      });
      const replacement = await ledger.claim([accountId], 'operation');
      expect(replacement?.kind === 'operation' && replacement.recovering).toBe(
        true,
      );
      await expect(ledger.finish(job, { externalId: 'stale' })).rejects.toThrow(
        'BILLING_LEASE_LOST',
      );
      expect(await ledger.heartbeat(job)).toBe(false);
      if (!replacement) throw Error('replacement missing');
      await processor.process(replacement);
      expect(
        (
          await db.billingOperation.findUniqueOrThrow({
            where: { id: job.row.id },
          })
        ).status,
      ).toBe('succeeded');
    });
    test('preflight outage remains retryable and creates once after restart', async () => {
      const { job } = await purchase();
      const fake = Object.create(simulator) as SimulationGateway;
      const account = jest
        .spyOn(fake, 'assertAccount')
        .mockRejectedValueOnce(Error('synthetic outage'))
        .mockResolvedValue(undefined);
      const create = jest.spyOn(fake, 'createCheckout');
      const find = jest.spyOn(fake, 'findCheckout');
      jest.spyOn(gateways, 'get').mockResolvedValue(fake);
      try {
        await processor.process(job);
        const failed = await db.billingOperation.findUniqueOrThrow({
          where: { id: job.row.id },
        });
        expect(failed.status).toBe('ready');
        expect(create).not.toHaveBeenCalled();
        await db.billingOperation.update({
          where: { id: failed.id },
          data: { nextAttemptAt: new Date(0) },
        });
        const retried = await ledger.claim([accountId], 'operation');
        if (!retried) throw Error('retry missing');
        await new BillingProcessor(ledger, gateways).process(retried);
        expect(create).toHaveBeenCalledTimes(1);
        expect(find).not.toHaveBeenCalled();
        expect(account).toHaveBeenCalledTimes(2);
      } finally {
        jest.restoreAllMocks();
      }
    });
    test('verified expiration closes an unpaid checkout and allows a new purchase', async () => {
      const { job, command, obligation } = await purchase();
      await processor.process(job);
      const snapshot = {
        payments: [],
        checkoutExpiration: {
          checkoutId: `sim_${command.reference}`,
          reference: command.reference,
          operationId: job.row.id,
          tenantId,
          localSubscriptionId: command.subscriptionId,
          money: command.money,
        },
      };
      for (const eventKey of ['expired-first', 'expired-duplicate']) {
        await ledger.receive(accountId, 'sandbox', {
          eventKey,
          topic: 'checkout.session.expired',
          resourceId: 'cs_expired',
        });
        const inbox = await ledger.claim([accountId], 'inbox');
        if (!inbox) throw Error('inbox missing');
        await ledger.finish(inbox, { snapshot });
      }
      expect(
        (
          await db.billingObligation.findUniqueOrThrow({
            where: { id: obligation.id },
          })
        ).status,
      ).toBe('void');
      expect(
        (
          await db.billingOrder.findUniqueOrThrow({
            where: { id: obligation.orderId },
          })
        ).status,
      ).toBe('expired');
      expect(
        (
          await db.billingSubscription.findUniqueOrThrow({
            where: { id: command.subscriptionId },
          })
        ).status,
      ).toBe('ended');
      const failed = await notify(command, 'rejected');
      expect(
        (
          await db.billingWebhookInbox.findUniqueOrThrow({
            where: { id: failed.row.id },
          })
        ).status,
      ).toBe('completed');
      const contradictory = await notify(command, 'approved');
      expect(
        (
          await db.billingWebhookInbox.findUniqueOrThrow({
            where: { id: contradictory.row.id },
          })
        ).status,
      ).toBe('review');
      expect(
        await db.billingAccessPeriod.count({
          where: { tenantId, kind: 'paid' },
        }),
      ).toBe(0);
      const next = await settlements.preparePurchase({
        tenantId,
        environment: 'sandbox',
        priceId,
        mode: 'manual',
        cycleKey: 'after-expiration',
      });
      expect(next.subscriptionId).not.toBe(command.subscriptionId);
    });
    test('unsubmitted lease recovery creates, but legacy uncertainty only searches', async () => {
      const { job } = await purchase();
      await db.billingOperation.update({
        where: { id: job.row.id },
        data: { leaseUntil: new Date(0) },
      });
      const recovered = await ledger.claim([accountId], 'operation');
      expect(recovered?.kind === 'operation' && recovered.recovering).toBe(
        false,
      );
      if (!recovered) throw Error('recover missing');
      await expect(ledger.markCheckoutSubmitted(job)).rejects.toThrow(
        'BILLING_LEASE_LOST',
      );
      await processor.process(recovered);
      const row = await db.billingOperation.findUniqueOrThrow({
        where: { id: job.row.id },
      });
      expect(row.status).toBe('succeeded');
      expect(row.requestHash).toBe(job.row.requestHash);
      await db.billingOperation.update({
        where: { id: row.id },
        data: {
          status: 'uncertain',
          requestData: { entityId: row.entityId },
          externalResourceId: null,
          nextAttemptAt: new Date(0),
        },
      });
      const legacy = await ledger.claim([accountId], 'operation');
      expect(legacy?.kind === 'operation' && legacy.recovering).toBe(true);
      const fake = Object.create(simulator) as SimulationGateway;
      const create = jest.spyOn(fake, 'createCheckout');
      jest.spyOn(fake, 'findCheckout').mockResolvedValue(null);
      jest.spyOn(gateways, 'get').mockResolvedValue(fake);
      try {
        if (!legacy) throw Error('legacy missing');
        await processor.process(legacy);
        expect(create).not.toHaveBeenCalled();
      } finally {
        jest.restoreAllMocks();
      }
    });
    test.each([false, true])(
      'operator retry preserves submission uncertainty: submitted=%s',
      async (submitted) => {
        const { job } = await purchase();
        if (submitted) await ledger.markCheckoutSubmitted(job);
        await db.billingOperation.update({
          where: { id: job.row.id },
          data: { attempts: 10 },
        });
        await ledger.fail(
          { ...job, row: { ...job.row, attempts: 10 } },
          'BILLING_PROVIDER_UNAVAILABLE',
        );
        const actor = await db.user.create({
          data: {
            tenantId,
            email: `${randomUUID()}@synthetic.invalid`,
            passwordHash: 'synthetic-test-only',
          },
        });
        await new BillingOperatorRepository(
          db as unknown as PrismaService,
        ).setMembership(actor.id, true);
        await ledger.retry(actor.id, job.row.id, 'operation');
        const retried = await ledger.claim([accountId], 'operation');
        expect(retried?.kind === 'operation' && retried.recovering).toBe(
          submitted,
        );
        if (!retried) throw Error('retry missing');
        const fake = Object.create(simulator) as SimulationGateway;
        const create = jest.spyOn(fake, 'createCheckout');
        const find = jest
          .spyOn(fake, 'findCheckout')
          .mockResolvedValue({ id: 'sim_recovered', url: null });
        jest.spyOn(gateways, 'get').mockResolvedValue(fake);
        try {
          await processor.process(retried);
          expect(create).toHaveBeenCalledTimes(submitted ? 0 : 1);
          expect(find).toHaveBeenCalledTimes(submitted ? 1 : 0);
          expect(
            (
              await db.billingOperation.findUniqueOrThrow({
                where: { id: job.row.id },
              })
            ).status,
          ).toBe('succeeded');
        } finally {
          jest.restoreAllMocks();
        }
      },
    );
    test('expiration rejects mismatched identity or amount without closing the obligation', async () => {
      const { job, command, obligation } = await purchase();
      await processor.process(job);
      for (const override of [
        { tenantId: randomUUID() },
        { reference: randomUUID() },
        { operationId: randomUUID() },
        { localSubscriptionId: randomUUID() },
        { checkoutId: 'another-checkout' },
        { money: { amountMinor: 1n, currency: 'USD' as const } },
      ]) {
        const e = await expiry(command, job.row.id, override);
        await expect(
          ledger.finish(e.job, { snapshot: e.snapshot }),
        ).rejects.toThrow('BILLING_EXPIRATION_MISMATCH');
      }
      expect(
        (
          await db.billingObligation.findUniqueOrThrow({
            where: { id: obligation.id },
          })
        ).status,
      ).toBe('open');
    });
    test('expiration during manual renewal preserves paid coverage and original contract', async () => {
      const first = await purchase();
      await processor.process(first.job);
      await notify(first.command, 'approved');
      const before = await db.billingSubscription.findUniqueOrThrow({
        where: { id: first.command.subscriptionId },
      });
      const renewal = await settlements.preparePurchase({
        tenantId,
        environment: 'sandbox',
        priceId,
        mode: 'manual',
        cycleKey: 'renewal-to-expire',
      });
      const op = await ledger.enqueueCheckout(
        tenantId,
        'sandbox',
        renewal.id,
        'renewal-to-expire',
      );
      const job = await ledger.claim([accountId], 'operation');
      if (!job) throw Error('job missing');
      const command = await ledger.command(job);
      await processor.process(job);
      const e = await expiry(command, op.id);
      await ledger.finish(e.job, { snapshot: e.snapshot });
      const after = await db.billingSubscription.findUniqueOrThrow({
        where: { id: before.id },
      });
      expect(after.status).toBe('active');
      expect(after.paidThrough).toEqual(before.paidThrough);
      expect(
        await db.billingAccessPeriod.count({
          where: { tenantId, revokedAt: null, kind: 'paid' },
        }),
      ).toBe(1);
      await ledger.scheduleReconciliation([accountId]);
      expect(
        await db.billingOperation.count({
          where: { kind: 'reconcile', entityId: renewal.id },
        }),
      ).toBe(0);
      await expect(
        settlements.preparePurchase({
          tenantId,
          environment: 'sandbox',
          priceId,
          mode: 'manual',
          cycleKey: 'after-renewal-expiration',
        }),
      ).resolves.toMatchObject({ subscriptionId: before.id });
    });
    test('expiration concurrent with payment reconfirmation cannot revoke access', async () => {
      const { job, command, obligation } = await purchase();
      await processor.process(job);
      const e = await expiry(command, job.row.id);
      await notify(command, 'approved');
      const results = await Promise.allSettled([
        ledger.finish(e.job, { snapshot: e.snapshot }),
        notify(command, 'approved'),
      ]);
      expect(results[0]).toMatchObject({
        status: 'rejected',
        reason: { code: 'BILLING_EXPIRATION_CONFLICT' },
      });
      expect(results[1]!.status).toBe('fulfilled');
      expect(
        (
          await db.billingObligation.findUniqueOrThrow({
            where: { id: obligation.id },
          })
        ).status,
      ).toBe('paid');
      expect(
        await db.billingAccessPeriod.count({
          where: { tenantId, revokedAt: null },
        }),
      ).toBe(1);
    });
    test('concurrent expiration notifications close once', async () => {
      const { job, command, obligation } = await purchase();
      await processor.process(job);
      const first = await expiry(command, job.row.id),
        second = await expiry(command, job.row.id);
      await Promise.all([
        ledger.finish(first.job, { snapshot: first.snapshot }),
        ledger.finish(second.job, { snapshot: second.snapshot }),
      ]);
      expect(
        await db.billingAudit.count({
          where: {
            tenantId,
            action: 'checkout.expired',
            entityId: obligation.id,
          },
        }),
      ).toBe(1);
      expect(await db.billingAccessPeriod.count({ where: { tenantId } })).toBe(
        0,
      );
    });
    test('reconciliation can resolve a verified initial automatic expiration without rescheduling it', async () => {
      const { job, command, obligation } = await purchase('automatic');
      await processor.process(job);
      await ledger.scheduleReconciliation([accountId]);
      const reconcile = await ledger.claim([accountId], 'operation');
      if (!reconcile) throw Error('reconcile missing');
      const e = await expiry(command, job.row.id);
      const fake = Object.create(simulator) as SimulationGateway;
      jest.spyOn(fake, 'reconcile').mockResolvedValue(e.snapshot);
      jest.spyOn(gateways, 'get').mockResolvedValue(fake);
      try {
        await processor.process(reconcile);
      } finally {
        jest.restoreAllMocks();
      }
      expect(
        (
          await db.billingObligation.findUniqueOrThrow({
            where: { id: obligation.id },
          })
        ).status,
      ).toBe('void');
      await ledger.scheduleReconciliation([accountId]);
      expect(
        await db.billingOperation.count({
          where: { kind: 'reconcile', entityId: command.subscriptionId },
        }),
      ).toBe(1);
      expect(
        (
          await db.billingOperation.findUniqueOrThrow({
            where: { id: reconcile.row.id },
          })
        ).status,
      ).toBe('succeeded');
    });
    test('timeout after POST performs lookup after restart and never sends a second POST', async () => {
      const { job } = await purchase();
      const fake = Object.create(simulator) as SimulationGateway;
      const create = jest
        .spyOn(fake, 'createCheckout')
        .mockRejectedValue(new Error('synthetic timeout after send'));
      const find = jest
        .spyOn(fake, 'findCheckout')
        .mockResolvedValue({ id: 'sim_external', url: null });
      jest.spyOn(gateways, 'get').mockResolvedValue(fake);
      try {
        await processor.process(job);
        await db.billingOperation.update({
          where: { id: job.row.id },
          data: { nextAttemptAt: new Date(0) },
        });
        const recovered = await ledger.claim([accountId], 'operation');
        if (!recovered) throw Error('recover missing');
        await new BillingProcessor(ledger, gateways).process(recovered);
        expect(create).toHaveBeenCalledTimes(1);
        expect(find).toHaveBeenCalledTimes(1);
        expect(
          (
            await db.billingOperation.findUniqueOrThrow({
              where: { id: job.row.id },
            })
          ).externalResourceId,
        ).toBe('sim_external');
      } finally {
        jest.restoreAllMocks();
      }
    });
    test('an inconclusive lookup stays uncertain and eventually requires operational review', async () => {
      const { job } = await purchase();
      await ledger.markCheckoutSubmitted(job);
      await ledger.fail(job, 'BILLING_CHECKOUT_UNCERTAIN');
      await db.billingOperation.update({
        where: { id: job.row.id },
        data: { attempts: 9, nextAttemptAt: new Date(0) },
      });
      const recovered = await ledger.claim([accountId], 'operation');
      if (!recovered) throw Error('recover missing');
      const fake = Object.create(simulator) as SimulationGateway;
      const create = jest.spyOn(fake, 'createCheckout');
      jest.spyOn(fake, 'findCheckout').mockResolvedValue(null);
      jest.spyOn(gateways, 'get').mockResolvedValue(fake);
      try {
        await processor.process(recovered);
        expect(create).not.toHaveBeenCalled();
        expect(
          (
            await db.billingOperation.findUniqueOrThrow({
              where: { id: job.row.id },
            })
          ).status,
        ).toBe('review');
      } finally {
        jest.restoreAllMocks();
      }
    });
    test('parallel deliveries grant once, late pending cannot undo settlement, refund revokes only its grant', async () => {
      const { job, command } = await purchase();
      await processor.process(job);
      const resourceId = simulator.observation(
        command,
        'approved',
        new Date('2026-10-20T00:00:00Z'),
      );
      await Promise.all(
        Array.from({ length: 8 }, () =>
          ledger.receive(accountId, 'sandbox', {
            topic: 'simulation',
            resourceId,
            eventKey: 'delivery-one',
          }),
        ),
      );
      expect(await db.billingWebhookInbox.count()).toBe(1);
      const inbox = await ledger.claim([accountId], 'inbox');
      if (!inbox) throw Error('inbox missing');
      await processor.process(inbox);
      await notify(command, 'approved');
      await notify(command, 'pending');
      expect(
        await db.billingAccessPeriod.count({
          where: { tenantId, kind: 'paid' },
        }),
      ).toBe(1);
      expect(
        (await db.billingPayment.findFirstOrThrow({ where: { tenantId } }))
          .status,
      ).toBe('succeeded');
      await notify(command, 'partial_refund');
      expect(
        await db.billingAccessPeriod.count({
          where: { tenantId, revokedAt: null },
        }),
      ).toBe(1);
      await notify(command, 'full_refund');
      expect(
        await db.billingAccessPeriod.count({
          where: { tenantId, revokedAt: null },
        }),
      ).toBe(0);
      expect(await db.billingAdjustment.count({ where: { tenantId } })).toBe(2);
    });
    test('automatic external cycles produce separate obligations; two payments of one cycle grant once', async () => {
      const { job, command } = await purchase('automatic');
      await processor.process(job);
      await notify(command, 'approved');
      await notify(command, 'approved', 'renewal');
      expect(
        await db.billingObligation.count({
          where: { tenantId, status: 'paid' },
        }),
      ).toBe(2);
      expect(
        await db.billingAccessPeriod.count({
          where: { tenantId, kind: 'paid' },
        }),
      ).toBe(2);
      await notify(command, 'approved', 'renewal');
      expect(await db.billingAccessPeriod.count({ where: { tenantId } })).toBe(
        2,
      );
      const resourceId = simulator.observation(
        command,
        'approved',
        new Date('2026-10-20T00:00:00Z'),
        'renewal',
      );
      await ledger.receive(accountId, 'sandbox', {
        topic: 'simulation',
        resourceId,
        eventKey: 'extra-payment',
      });
      const extra = await ledger.claim([accountId], 'inbox');
      if (!extra) throw Error('extra missing');
      const snapshot = await simulator.read('simulation', resourceId);
      snapshot.payments[0]!.id += '-extra';
      await ledger.finish(extra, { snapshot });
      expect(await db.billingPayment.count({ where: { tenantId } })).toBe(3);
      expect(await db.billingAccessPeriod.count({ where: { tenantId } })).toBe(
        2,
      );
      expect(
        await db.billingAudit.count({
          where: { tenantId, action: 'payment.additional' },
        }),
      ).toBe(1);
    });
    test('provider mismatch rolls back payment, access and receipt completion together', async () => {
      const { job, command } = await purchase();
      await processor.process(job);
      const wrong = {
        ...command,
        money: { ...command.money, amountMinor: 1n },
      };
      const inbox = await notify(wrong, 'approved');
      expect(await db.billingPayment.count({ where: { tenantId } })).toBe(0);
      expect(await db.billingAccessPeriod.count({ where: { tenantId } })).toBe(
        0,
      );
      expect(
        (
          await db.billingWebhookInbox.findUniqueOrThrow({
            where: { id: inbox.row.id },
          })
        ).status,
      ).toBe('review');
    });
    test('stale inbox cannot grant even with a valid provider observation', async () => {
      const { command } = await purchase();
      const resourceId = simulator.observation(command, 'approved', new Date());
      await ledger.receive(accountId, 'sandbox', {
        topic: 'simulation',
        resourceId,
        eventKey: 'fenced',
      });
      const inbox = await ledger.claim([accountId], 'inbox');
      if (!inbox) throw Error('inbox missing');
      await db.billingWebhookInbox.update({
        where: { id: inbox.row.id },
        data: { leaseUntil: new Date(0) },
      });
      await processor.process(inbox);
      expect(await db.billingPayment.count({ where: { tenantId } })).toBe(0);
    });
    test('cancellation is durable and keeps the paid period', async () => {
      const { job, command } = await purchase('automatic');
      await processor.process(job);
      await notify(command, 'approved');
      const operation = await ledger.enqueueCancellation(
        tenantId,
        'sandbox',
        command.subscriptionId,
        'cancel-key',
      );
      const cancel = await ledger.claim([accountId], 'operation');
      expect(cancel?.row.id).toBe(operation.id);
      if (!cancel) throw Error('cancel missing');
      await processor.process(cancel);
      expect(
        (
          await db.billingSubscription.findUniqueOrThrow({
            where: { id: command.subscriptionId },
          })
        ).status,
      ).toBe('canceled');
      expect(
        await db.billingAccessPeriod.count({
          where: { tenantId, revokedAt: null },
        }),
      ).toBe(1);
    });
    test('manual renewal reconciliation targets every obligation and retains the original checkout identity', async () => {
      const first = await purchase();
      await processor.process(first.job);
      await notify(first.command, 'approved');
      const next = await settlements.preparePurchase({
        tenantId,
        environment: 'sandbox',
        priceId,
        mode: 'manual',
        cycleKey: 'second-period',
      });
      const checkout = await ledger.enqueueCheckout(
        tenantId,
        'sandbox',
        next.id,
        'second-checkout',
      );
      const job = await ledger.claim([accountId], 'operation');
      if (!job) throw Error('checkout missing');
      await processor.process(job);
      await ledger.scheduleReconciliation([accountId]);
      const rows = await db.billingOperation.findMany({
        where: { tenantId, kind: 'reconcile' },
        orderBy: { createdAt: 'asc' },
      });
      expect(new Set(rows.map((row) => row.entityId))).toEqual(
        new Set([first.obligation.id, next.id]),
      );
      const row = rows.find((row) => row.entityId === next.id)!;
      const c = await ledger.command({
        kind: 'operation',
        row,
        recovering: false,
      });
      expect(c.operationId).toBe(checkout.id);
      expect(c.reference).not.toBe(first.command.reference);
      expect(c.knownCheckoutId).toBe(`sim_${c.reference}`);
    });
    test('Retry-After persists a lower bound on provider retry and preserves operation identity', async () => {
      const { job } = await purchase();
      const before = Date.now();
      await ledger.fail(job, 'BILLING_PROVIDER_UNAVAILABLE', false, 120000);
      const saved = await db.billingOperation.findUniqueOrThrow({
        where: { id: job.row.id },
      });
      expect(saved.nextAttemptAt.getTime()).toBeGreaterThanOrEqual(
        before + 120000,
      );
      expect(saved.idempotencyKey).toBe('checkout-key');
      expect(await ledger.claim([accountId], 'operation')).toBeNull();
    });
    test('simulation CLI requires a live database operator and grants through the durable inbox', async () => {
      const { command, operation } = await purchase();
      const actor = (
        await db.user.create({
          data: {
            tenantId,
            email: `${randomUUID()}@example.invalid`,
            passwordHash: 'synthetic-non-authenticatable',
          },
        })
      ).id;
      const args = [
        actor,
        operation.id,
        'approved',
        '2026-10-20T00:00:00.000Z',
        'initial',
        '--apply',
      ];
      const env = {
        BILLING_MODE: 'simulation',
        BILLING_CONFIG_JSON: JSON.stringify({
          returnUrl: 'http://localhost:3000/return',
          simulationKey,
        }),
        BILLING_SIMULATION_DATABASE_URL: fixture.url,
      };
      await expect(runSimulation(args, env)).rejects.toThrow(
        'BILLING_OPERATOR_REQUIRED',
      );
      const operator = new BillingOperatorRepository(
        db as unknown as PrismaService,
      );
      await expect(
        runBillingWorker(['--once', actor, '--apply'], {
          ...env,
          BILLING_WORKER_DATABASE_URL: fixture.url,
        }),
      ).rejects.toThrow('BILLING_OPERATOR_REQUIRED');
      await operator.setMembership(actor, true);
      expect(
        await runBillingWorker(['--once', actor, '--apply'], {
          ...env,
          BILLING_WORKER_DATABASE_URL: fixture.url,
        }),
      ).toEqual({ accepted: true, accounts: 1 });
      expect(await runSimulation(args, env)).toEqual({
        operationId: operation.id,
        scenario: 'approved',
        accepted: true,
      });
      expect(
        await db.billingAccessPeriod.count({
          where: { tenantId, kind: 'paid' },
        }),
      ).toBe(1);
      await operator.setMembership(actor, false);
      await expect(
        runBillingWorker(['--once', actor, '--apply'], {
          ...env,
          BILLING_WORKER_DATABASE_URL: fixture.url,
        }),
      ).rejects.toThrow('BILLING_OPERATOR_REQUIRED');
      await expect(runSimulation(args, env)).rejects.toThrow(
        'BILLING_OPERATOR_REQUIRED',
      );
      expect(command.tenantId).toBe(tenantId);
    });
    test('draft prices cannot be bound remotely before immutable publication', async () => {
      const actor = (
        await db.user.create({
          data: {
            tenantId,
            email: `${randomUUID()}@example.invalid`,
            passwordHash: 'synthetic-non-authenticatable',
          },
        })
      ).id;
      await new BillingOperatorRepository(
        db as unknown as PrismaService,
      ).setMembership(actor, true);
      const plan = await db.billingPlan.create({
        data: { code: `draft-${randomUUID()}` },
      });
      const version = await db.billingPlanVersion.create({
        data: {
          planId: plan.id,
          version: 1,
          name: 'Synthetic draft',
          media: false,
          analytics: false,
          scoring: false,
          businessIntelligence: false,
          biStatistics: false,
          apiKeys: false,
          webhooks: false,
        },
      });
      const price = await db.billingPrice.create({
        data: {
          planVersionId: version.id,
          provider: 'stripe',
          currency: 'USD',
          interval: 'month',
          amountMinor: 1999n,
          manualEnabled: true,
          automaticEnabled: true,
        },
      });
      await expect(
        ledger.enqueueSync(actor, accountId, price.id, 'draft-sync'),
      ).rejects.toThrow('BILLING_PLAN_NOT_PUBLISHED');
      expect(await db.billingOperation.count()).toBe(0);
      await db.billingPlanVersion.update({
        where: { id: version.id },
        data: { status: 'published', publishedAt: new Date() },
      });
      const sync = await ledger.enqueueSync(
        actor,
        accountId,
        price.id,
        'published-sync',
      );
      const job = await ledger.claim([accountId], 'operation');
      if (!job) throw Error('sync missing');
      await processor.process(job);
      expect(
        (
          await db.billingOperation.findUniqueOrThrow({
            where: { id: sync.id },
          })
        ).status,
      ).toBe('succeeded');
      expect(
        (
          await db.billingPriceBinding.findUniqueOrThrow({
            where: {
              priceId_providerAccountId: {
                priceId: price.id,
                providerAccountId: accountId,
              },
            },
          })
        ).status,
      ).toBe('ready');
    });
    test('Stripe HTTP verifies original bytes despite ambient cookies; durable insert precedes ACK', async () => {
      const payload = JSON.stringify({
        id: 'evt_http',
        type: 'payment_intent.succeeded',
        livemode: false,
        data: { object: { id: 'pi_http' } },
      });
      const signature = new Stripe(
        'sk_test_synthetic',
      ).webhooks.generateTestHeaderString({ payload, secret });
      await request(app.getHttpServer())
        .post('/api/v1/billing/webhooks/stripe')
        .set('content-type', 'application/json')
        .set('cookie', 'accessToken=ambient')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(200);
      expect(
        await db.billingWebhookInbox.count({ where: { eventKey: 'evt_http' } }),
      ).toBe(1);
      await request(app.getHttpServer())
        .post('/api/v1/billing/webhooks/stripe')
        .set('content-type', 'application/json')
        .set('stripe-signature', signature)
        .send(payload + ' ')
        .expect(401);
      await request(app.getHttpServer())
        .post('/api/v1/billing/webhooks/stripe')
        .send({ status: 'paid' })
        .expect(401);
    });
    test('MP HTTP authenticates query resource and distinct updates, invalid signature cannot enqueue', async () => {
      const ts = String(Math.floor(Date.now() / 1000));
      const rid = 'synthetic-request';
      const id = '12345';
      const signature = `ts=${ts},v1=${createHmac('sha256', secret).update(`id:${id};request-id:${rid};ts:${ts};`).digest('hex')}`;
      const post = () =>
        request(app.getHttpServer())
          .post('/api/v1/billing/webhooks/mercadopago?data.id=12345')
          .set('x-request-id', rid)
          .set('x-signature', signature);
      await post().send({ type: 'payment', data: { id } }).expect(200);
      await post().send({ type: 'payment', data: { id } }).expect(200);
      expect(await db.billingWebhookInbox.count()).toBe(1);
      await post()
        .send({ type: 'payment', data: { id: 'other' } })
        .expect(400);
      await request(app.getHttpServer())
        .post('/api/v1/billing/webhooks/mercadopago?data.id=12345')
        .send({ type: 'payment', data: { id } })
        .expect(401);
      expect(await db.billingWebhookInbox.count()).toBe(1);
      const longId = '234000062890459001';
      const longSignature = `ts=${ts},v1=${createHmac('sha256', secret).update(`id:${longId};request-id:${rid};ts:${ts};`).digest('hex')}`;
      await request(app.getHttpServer())
        .post(`/api/v1/billing/webhooks/mercadopago?data.id=${longId}`)
        .set('content-type', 'application/json')
        .set('x-request-id', rid)
        .set('x-signature', longSignature)
        .send(`{"type":"topic_chargebacks_wh","data":{"id":${longId}}}`)
        .expect(200);
      expect(
        await db.billingWebhookInbox.count({ where: { resourceId: longId } }),
      ).toBe(1);
    });
    test('storage failure never sends a successful webhook ACK; body size is bounded', async () => {
      const payload = JSON.stringify({
        id: 'evt_storage_fail',
        type: 'payment_intent.succeeded',
        livemode: false,
        data: { object: { id: 'pi_http' } },
      });
      const signature = new Stripe(
        'sk_test_synthetic',
      ).webhooks.generateTestHeaderString({ payload, secret });
      const spy = jest
        .spyOn(ledger, 'receive')
        .mockRejectedValueOnce(new Error('synthetic database unavailable'));
      await request(app.getHttpServer())
        .post('/api/v1/billing/webhooks/stripe')
        .set('content-type', 'application/json')
        .set('stripe-signature', signature)
        .send(payload)
        .expect(500);
      spy.mockRestore();
      expect(await db.billingWebhookInbox.count()).toBe(0);
      await request(app.getHttpServer())
        .post('/api/v1/billing/webhooks/stripe')
        .set('content-type', 'application/json')
        .send('x'.repeat(262145))
        .expect(413);
    });
  },
);
