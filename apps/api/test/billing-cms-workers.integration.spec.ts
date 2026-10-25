import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/modules/database/prisma.service';
import { createBillingDatabase } from './fixtures/billing-postgres';
import { BillingAccessRepository } from '../src/modules/billing/repositories/billing-access.repository';
import { lockBillingAccount } from '../src/modules/billing/repositories/billing-transaction';
import { TestimonialRepository } from '../src/modules/testimonials/repositories/testimonial.repository';
import { ScoringService } from '../src/modules/testimonials/services/scoring.service';
import { AnalyticsRepository } from '../src/modules/analytics/repositories/analytics.repository';
import { AnalyticsService } from '../src/modules/analytics/services/analytics.service';
import type { TenantsService } from '../src/modules/tenants';
import { OutboxRepository } from '../src/modules/webhooks/repositories/outbox.repository';

const parent =
  process.env.TEST_BILLING_DATABASE_URL ?? process.env.TEST_DATABASE_URL;
const describeDb = parent ? describe : describe.skip;
const simulation = {
  mode: 'simulation' as const,
  simulationKey: 'synthetic-workers-key-at-least-32',
  returnUrl: 'http://localhost/admin/billing/return',
};

describeDb('commercial policy in scoring and durable webhook workers', () => {
  let fixture: Awaited<ReturnType<typeof createBillingDatabase>>,
    db: PrismaClient,
    prisma: PrismaService;
  let access: BillingAccessRepository,
    tenantId: string,
    statusId: number,
    flagId: string;
  let logger: jest.SpyInstance;
  beforeAll(async () => {
    fixture = await createBillingDatabase(parent!);
    db = fixture.prisma;
    // Same transaction adapter as the existing scoring integration fixture;
    // queries/transactions are real, retry backoff is not the subject here.
    prisma = Object.assign(db, {
      withRetry: db.$transaction.bind(db),
    }) as unknown as PrismaService;
    access = new BillingAccessRepository(prisma, simulation);
    statusId = (
      await db.testimonialStatus.upsert({
        where: { code: 'published' },
        create: { code: 'published' },
        update: {},
      })
    ).id;
    flagId = (
      await db.featureFlag.upsert({
        where: { name: 'enable_scoring' },
        create: { name: 'enable_scoring' },
        update: {},
      })
    ).id;
    await db.webhookEvent.upsert({
      where: { code: 'testimonial.created' },
      create: { code: 'testimonial.created' },
      update: {},
    });
  }, 90000);
  beforeEach(async () => {
    tenantId = (
      await db.tenant.create({ data: { name: `Synthetic ${randomUUID()}` } })
    ).id;
    await db.billingAccount.create({
      data: { tenantId, enforcementEnabled: true },
    });
    await db.tenantFeatureFlag.create({
      data: { tenantId, featureFlagId: flagId, enabled: true },
    });
    logger = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    await fixture?.close();
  }, 30000);

  async function coverage(scoring: boolean, expired = false) {
    const plan = await db.billingPlan.create({
      data: { code: `p${randomUUID().replaceAll('-', '')}` },
    });
    const version = await db.billingPlanVersion.create({
      data: {
        planId: plan.id,
        version: 1,
        status: 'published',
        publishedAt: new Date(),
        name: 'Synthetic',
        trialDays: 14,
        graceDays: 0,
        media: false,
        analytics: true,
        scoring,
        businessIntelligence: false,
        biStatistics: false,
        apiKeys: false,
        webhooks: false,
      },
    });
    return db.billingAccessPeriod.create({
      data: {
        tenantId,
        environment: 'sandbox',
        planVersionId: version.id,
        kind: 'trial',
        startsAt: new Date(Date.now() - 86400000),
        endsAt: new Date(Date.now() + (expired ? -1000 : 86400000)),
      },
    });
  }
  async function testimonial(tid = tenantId, sid = statusId) {
    return db.testimonial.create({
      data: {
        tenantId: tid,
        statusId: sid,
        authorName: 'Synthetic',
        content: 'Synthetic scoring regression',
        rating: 5,
        publishedAt: new Date(),
        score: 7,
      },
    });
  }
  function worker(policy = access) {
    const repo = new TestimonialRepository(prisma, policy);
    const analytics = new AnalyticsService(
      new AnalyticsRepository(prisma),
      {} as TenantsService,
    );
    const metrics = jest.spyOn(analytics, 'getEngagementCounts');
    return { repo, metrics, service: new ScoringService(repo, analytics) };
  }
  async function score(id: string) {
    return Number(
      (await db.testimonial.findUniqueOrThrow({ where: { id } })).score,
    );
  }

  test.each(['excluded', 'expired'] as const)(
    'scoring skips commercial %s before loading engagement',
    async (reason) => {
      await coverage(reason !== 'excluded', reason === 'expired');
      const row = await testimonial();
      const w = worker();
      await w.service.processScores();
      expect(w.metrics).not.toHaveBeenCalled();
      expect(await score(row.id)).toBe(7);
      expect(logger).toHaveBeenCalledWith(
        expect.objectContaining({ updatedCount: 0 }),
        'Score calculation completed',
      );
    },
  );
  test('withdrawal during calculation prevents publication and reports zero updates', async () => {
    const period = await coverage(true);
    const row = await testimonial();
    const w = worker();
    // Use the real analytics query, then commit a commercial withdrawal before publication.
    w.metrics.mockImplementationOnce(async (tid, ids) => {
      const result = await new AnalyticsRepository(prisma).getEngagementCounts(
        tid,
        ids,
      );
      await db.$transaction(async (tx) => {
        await lockBillingAccount(tx, tenantId);
        await tx.billingAccessPeriod.update({
          where: { id: period.id },
          data: { revokedAt: new Date() },
        });
      });
      return result;
    });
    await w.service.processScores();
    expect(await score(row.id)).toBe(7);
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({ updatedCount: 0 }),
      'Score calculation completed',
    );
  });
  test('enabled scoring updates only published own rows and counts actual database updates', async () => {
    await coverage(true);
    const own = await testimonial();
    const other = (
      await db.tenant.create({ data: { name: 'Synthetic other' } })
    ).id;
    const foreign = await testimonial(other);
    const draft = await db.testimonialStatus.upsert({
      where: { code: 'draft' },
      create: { code: 'draft' },
      update: {},
    });
    const unpublished = await testimonial(tenantId, draft.id);
    const w = worker();
    await w.service.processScores();
    expect(await score(own.id)).toBeGreaterThan(49);
    expect(await score(foreign.id)).toBe(7);
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({ updatedCount: 1 }),
      'Score calculation completed',
    );
    expect(
      await w.repo.updateScores(tenantId, [
        { id: own.id, score: 77 },
        { id: foreign.id, score: 999 },
        { id: unpublished.id, score: 999 },
      ]),
    ).toBe(1);
    expect(await score(own.id)).toBe(77);
    expect(await score(foreign.id)).toBe(7);
    expect(await score(unpublished.id)).toBe(7);
  });
  test('publication waits for the commercial tenant lock and observes committed withdrawal', async () => {
    const period = await coverage(true);
    const row = await testimonial();
    const w = worker();
    let release!: () => void, signal!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const locked = new Promise<void>((resolve) => {
      signal = resolve;
    });
    const withdrawal = db.$transaction(
      async (tx) => {
        await lockBillingAccount(tx, tenantId);
        signal();
        await gate;
        await tx.billingAccessPeriod.update({
          where: { id: period.id },
          data: { revokedAt: new Date() },
        });
      },
      { timeout: 10000 },
    );
    await locked;
    const publication = w.repo.updateScores(tenantId, [
      { id: row.id, score: 99 },
    ]);
    let blocked = false;
    try {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const [state] = await db.$queryRaw<
          Array<{ waiting: boolean }>
        >`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
          AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query ILIKE '%billing_accounts%'
        ) AS waiting`;
        if (state?.waiting) {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } finally {
      release();
      await withdrawal;
    }
    expect(await publication).toBe(0);
    expect(blocked).toBe(true);
    expect(await score(row.id)).toBe(7);
  });
  test('billing disabled and tenant opt-out preserve scoring, but technical flags still apply', async () => {
    await coverage(false);
    const row = await testimonial();
    const disabled = new BillingAccessRepository(prisma, { mode: 'disabled' });
    const w = worker(disabled);
    await w.service.processScores();
    expect(await score(row.id)).toBeGreaterThan(49);
    await db.testimonial.update({ where: { id: row.id }, data: { score: 7 } });
    await db.billingAccount.update({
      where: { tenantId },
      data: { enforcementEnabled: false },
    });
    await worker().service.processScores();
    expect(await score(row.id)).toBeGreaterThan(49);
    await db.testimonial.update({ where: { id: row.id }, data: { score: 7 } });
    await db.tenantFeatureFlag.update({
      where: { tenantId_featureFlagId: { tenantId, featureFlagId: flagId } },
      data: { enabled: false },
    });
    await worker(disabled).service.processScores();
    expect(await score(row.id)).toBe(7);
  });

  async function suspendedDelivery() {
    const hook = await db.webhook.create({
      data: {
        tenantId,
        url: 'https://example.invalid/hook',
        eventId: (
          await db.webhookEvent.findUniqueOrThrow({
            where: { code: 'testimonial.created' },
          })
        ).id,
        secretCiphertext: 'synthetic-only',
        secretKeyVersion: 1,
        isActive: true,
      },
    });
    const outbox = new OutboxRepository(prisma, access);
    await outbox.createEvent({
      tenantId,
      eventType: 'testimonial.created',
      payload: { synthetic: true },
    });
    // Access is currently read-only. Suspend a real delivery with a prior failed attempt.
    const legacy = new OutboxRepository(prisma);
    const [claim] = await legacy.claimDue(25);
    if (!claim) throw Error('claim missing');
    await legacy.completeAttempt(claim, {
      status: 503,
      errorMessage: 'synthetic unavailable',
    });
    await outbox.refreshCommercialSuspensions();
    const delivery = await db.webhookDelivery.findFirstOrThrow({
      where: { tenantId, webhookId: hook.id },
    });
    expect(delivery.status).toBe('suspended');
    await db.$executeRaw`UPDATE webhook_deliveries SET updated_at=now()-interval '4 days',
      retry_budget_started_at=now()-interval '4 days'-interval '1 hour', next_retry_at=now()+interval '1 hour'
      WHERE id=${delivery.id}::uuid`;
    return {
      outbox,
      row: await db.webhookDelivery.findUniqueOrThrow({
        where: { id: delivery.id },
      }),
    };
  }
  test('disabling billing resumes only commercial suspensions and retains history and retry timing', async () => {
    const { row } = await suspendedDelivery();
    const history = await db.webhookDeliveryAttempt.findMany({
      where: { deliveryId: row.id },
    });
    const manualPause = await db.webhookDelivery.create({
      data: {
        tenantId,
        webhookId: row.webhookId,
        destinationUrl: row.destinationUrl,
        status: 'suspended',
        errorMessage: 'MANUAL_PAUSE',
      },
    });
    const disabled = new OutboxRepository(
      prisma,
      new BillingAccessRepository(prisma, { mode: 'disabled' }),
    );
    await Promise.all(
      Array.from({ length: 4 }, () => disabled.refreshCommercialSuspensions()),
    );
    const resumed = await db.webhookDelivery.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(
      await db.webhookDelivery.findUniqueOrThrow({
        where: { id: manualPause.id },
      }),
    ).toEqual(manualPause);
    expect(resumed.status).toBe('pending');
    expect(resumed.nextRetryAt).toEqual(row.nextRetryAt);
    expect(resumed.attempts).toBe(row.attempts);
    expect(resumed.retryBudgetAttempts).toBe(row.retryBudgetAttempts);
    expect(
      Math.abs(
        resumed.updatedAt.getTime() -
          resumed.retryBudgetStartedAt.getTime() -
          3600000,
      ),
    ).toBeLessThanOrEqual(2);
    expect(
      await db.webhookDeliveryAttempt.findMany({
        where: { deliveryId: row.id },
      }),
    ).toEqual(history);
    await disabled.refreshCommercialSuspensions();
    expect(
      (await db.webhookDelivery.findUniqueOrThrow({ where: { id: row.id } }))
        .retryBudgetStartedAt,
    ).toEqual(resumed.retryBudgetStartedAt);
    expect(
      (await disabled.claimDue(25)).find((c) => c.id === row.id),
    ).toBeUndefined();
    await db.webhookDelivery.update({
      where: { id: row.id },
      data: { nextRetryAt: new Date(0) },
    });
    const claims = (await disabled.claimDue(25)).filter((c) => c.id === row.id);
    expect(claims).toHaveLength(1);
    await disabled.completeAttempt(claims[0]!, { status: 204 });
    expect(
      (await db.webhookDelivery.findUniqueOrThrow({ where: { id: row.id } }))
        .status,
    ).toBe('success');
  });
});
