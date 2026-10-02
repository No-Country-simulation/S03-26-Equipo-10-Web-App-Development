import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/modules/database/prisma.service';
import { OutboxRepository } from '../src/modules/webhooks/repositories/outbox.repository';
import { WebhookRepository } from '../src/modules/webhooks/repositories/webhook.repository';
import { OutboxProcessor } from '../src/modules/webhooks/services/outbox.processor';
import { HttpWebhookDispatcher } from '../src/modules/webhooks/services/http-webhook-dispatcher';
import type { WebhookSecretService } from '../src/modules/webhooks/services/webhook-secret.service';
import type { WebhookDestinationPolicy } from '../src/modules/webhooks/services/webhook-destination-policy';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (process.env.CI && !testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required in CI for delivery ledger integration tests');
}
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('webhook delivery ledger in PostgreSQL', () => {
  let prisma: PrismaClient;
  let otherClient: PrismaClient;
  let repo: OutboxRepository;
  let otherRepo: OutboxRepository;
  let eventCode: string;
  const tenantIds: string[] = [];

  async function destination(count = 1) {
    const tenant = await prisma.tenant.create({ data: { name: `delivery-test-${randomUUID()}` } });
    tenantIds.push(tenant.id);
    const webhooks = await Promise.all(Array.from({ length: count }, (_, index) =>
      prisma.webhook.create({
        data: {
          tenantId: tenant.id,
          eventId: eventId,
          url: `https://hooks.example.com/${index}`,
        },
      }),
    ));
    return { tenantId: tenant.id, webhooks };
  }

  let eventId: number;

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required');
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    otherClient = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await Promise.all([prisma.$connect(), otherClient.$connect()]);
    eventCode = `integration.delivery.${randomUUID()}`;
    eventId = (await prisma.webhookEvent.create({ data: { code: eventCode } })).id;
    repo = new OutboxRepository(prisma as PrismaService);
    otherRepo = new OutboxRepository(otherClient as PrismaService);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.webhookDeliveryAttempt.deleteMany({ where: { delivery: { webhook: { tenantId: { in: tenantIds } } } } });
    await prisma.webhookDelivery.deleteMany({ where: { webhook: { tenantId: { in: tenantIds } } } });
    await prisma.outboxEvent.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.webhook.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    if (eventCode) await prisma.webhookEvent.delete({ where: { code: eventCode } });
    await Promise.all([prisma.$disconnect(), otherClient.$disconnect()]);
  });

  it('congela una entrega lógica por destino y dos procesadores no la duplican', async () => {
    const { tenantId, webhooks } = await destination(2);
    const outboxEventId = await repo.createEvent({ tenantId, eventType: eventCode, payload: { test: true } });
    await prisma.webhook.update({
      where: { id: webhooks[0]!.id },
      data: { url: 'https://hooks.example.com/changed' },
    });
    const sender = { dispatch: jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
      return { status: 200, body: 'ok' };
    }) } as unknown as HttpWebhookDispatcher;
    const secrets = { legacyStartedAt: () => null } as unknown as WebhookSecretService;
    const policy = { legacyHttpStartedAt: () => null } as unknown as WebhookDestinationPolicy;
    await Promise.all([
      new OutboxProcessor(repo, sender, new WebhookRepository(prisma as PrismaService), secrets, policy).process(),
      new OutboxProcessor(otherRepo, sender, new WebhookRepository(otherClient as PrismaService), secrets, policy).process(),
    ]);
    const deliveries = await prisma.webhookDelivery.findMany({ where: { outboxEventId }, include: { attemptHistory: true } });
    expect(deliveries).toHaveLength(2);
    expect(deliveries.every(delivery => delivery.status === 'success' && delivery.attemptHistory.length === 1)).toBe(true);
    expect((sender.dispatch as jest.Mock).mock.calls.filter(call => call[2] === outboxEventId)).toHaveLength(2);
    expect(sender.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ id: webhooks[0]!.id, url: 'https://hooks.example.com/0' }),
      expect.anything(), outboxEventId,
    );
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: outboxEventId } })).status).toBe('processed');
  });

  it('recupera un lease tras crash y descarta el resultado tardío', async () => {
    const { tenantId } = await destination();
    const outboxEventId = await repo.createEvent({ tenantId, eventType: eventCode, payload: {} });
    const oldClaim = (await repo.claimDue(1))[0]!;
    await prisma.webhookDelivery.update({
      where: { id: oldClaim.id },
      data: { leaseUntil: new Date(Date.now() - 1000) },
    });
    expect(await otherRepo.recoverExpired()).toBe(1);
    await prisma.webhookDelivery.update({ where: { id: oldClaim.id }, data: { nextRetryAt: new Date(Date.now() - 1000) } });
    const newClaim = (await otherRepo.claimDue(1))[0]!;
    expect(newClaim.id).toBe(oldClaim.id);
    expect(newClaim.leaseToken).not.toBe(oldClaim.leaseToken);
    expect(await repo.completeAttempt(oldClaim, { status: 200 })).toBe(false);
    expect(await otherRepo.completeAttempt(newClaim, { status: 200 })).toBe(true);
    const delivery = await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: oldClaim.id }, include: { attemptHistory: true } });
    expect(delivery.attemptHistory.map(attempt => attempt.status)).toEqual(['interrupted', 'success']);
    expect(delivery.status).toBe('success');
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: outboxEventId } })).status).toBe('processed');
  });

  it('mantiene 503 pendiente, termina tras diez intentos y permite reenvío administrativo', async () => {
    const { tenantId, webhooks } = await destination();
    const outboxEventId = await repo.createEvent({ tenantId, eventType: eventCode, payload: {} });
    for (let attempt = 1; attempt <= 10; attempt++) {
      const claim = (await repo.claimDue(1))[0]!;
      expect(claim).toBeDefined();
      await repo.completeAttempt(claim, { status: 503, body: 'temporarily unavailable' });
      const delivery = await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: claim.id } });
      expect(delivery.status).toBe(attempt === 10 ? 'dead' : 'pending');
      if (attempt < 10) {
        expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: outboxEventId } })).status).toBe('pending');
        await prisma.webhookDelivery.update({ where: { id: claim.id }, data: { nextRetryAt: new Date(Date.now() - 1000) } });
      }
    }
    const delivery = await prisma.webhookDelivery.findFirstOrThrow({ where: { outboxEventId } });
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: outboxEventId } })).status).toBe('processed');
    const webhooksRepo = new WebhookRepository(prisma as PrismaService);
    await webhooksRepo.remove(tenantId, webhooks[0]!.id);
    expect((await webhooksRepo.findByTenant(tenantId))[0]?.deletedAt).not.toBeNull();
    expect((await webhooksRepo.findDeliveries(webhooks[0]!.id))[0]?.status).toBe('dead');
    expect(await repo.replayDead(randomUUID(), webhooks[0]!.id, delivery.id)).toBe(false);
    expect(await repo.replayDead(tenantId, webhooks[0]!.id, delivery.id)).toBe(true);
    const replayClaim = (await repo.claimDue(1))[0]!;
    expect(replayClaim.attemptNo).toBe(11);
    await repo.completeAttempt(replayClaim, { status: 204 });
    expect((await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).status).toBe('success');
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: outboxEventId } })).status).toBe('processed');
  });

  it('termina un 4xx definitivo y agota el plazo de 72 horas', async () => {
    const { tenantId } = await destination();
    const firstId = await repo.createEvent({ tenantId, eventType: eventCode, payload: {} });
    const claim = (await repo.claimDue(1))[0]!;
    await repo.completeAttempt(claim, { status: 400 });
    expect((await prisma.webhookDelivery.findUniqueOrThrow({ where: { id: claim.id } })).status).toBe('dead');
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: firstId } })).status).toBe('processed');

    const secondId = await repo.createEvent({ tenantId, eventType: eventCode, payload: {} });
    await prisma.webhookDelivery.updateMany({
      where: { outboxEventId: secondId },
      data: { retryBudgetStartedAt: new Date(Date.now() - 73 * 60 * 60 * 1000) },
    });
    expect(await repo.recoverExpired()).toBe(1);
    expect((await prisma.webhookDelivery.findFirstOrThrow({ where: { outboxEventId: secondId } })).status).toBe('dead');
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: secondId } })).status).toBe('processed');
  });

  it('recupera un evento legado pendiente sin crear una segunda entrega lógica', async () => {
    const { tenantId } = await destination();
    const event = await prisma.outboxEvent.create({
      data: { tenantId, eventType: eventCode, payload: {}, status: 'pending' },
    });
    await Promise.all([repo.initializePending(), otherRepo.initializePending()]);
    await repo.initializePending();
    expect(await prisma.webhookDelivery.count({ where: { outboxEventId: event.id } })).toBe(1);
    expect((await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).deliveriesInitializedAt).not.toBeNull();
  });

  it('redacta y trunca cuerpos y errores antes de persistir intentos', async () => {
    const { tenantId } = await destination();
    const outboxEventId = await repo.createEvent({ tenantId, eventType: eventCode, payload: {} });
    const claims = await repo.claimDue(100);
    const claim = claims.find(candidate => candidate.outboxEventId === outboxEventId)!;
    expect(claim).toBeDefined();
    for (const other of claims.filter(candidate => candidate.id !== claim.id)) {
      await repo.completeAttempt(other, { status: 204 });
    }
    const secret = `whsec_${'a'.repeat(64)}`;
    await repo.completeAttempt(claim, { status: 500,
      body: `{"secret":"${secret}"}${'x'.repeat(3000)}`,
      errorMessage: `Bearer ${secret} ${'y'.repeat(3000)}` });
    const delivery = await prisma.webhookDelivery.findFirstOrThrow({ where: { outboxEventId },
      include: { attemptHistory: true } });
    for (const value of [delivery.responseBody, delivery.errorMessage,
      delivery.attemptHistory[0]?.responseBody, delivery.attemptHistory[0]?.errorMessage]) {
      expect(value).not.toContain(secret);
      expect(value!.length).toBeLessThanOrEqual(2048);
    }
  });
});
