import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { WebhookRepository } from '../src/modules/webhooks/repositories/webhook.repository';
import { WebhooksService } from '../src/modules/webhooks/services/webhooks.service';
import { WebhookSecretService } from '../src/modules/webhooks/services/webhook-secret.service';
import type { WebhookDestinationPolicy } from '../src/modules/webhooks/services/webhook-destination-policy';
import type { OutboxRepository } from '../src/modules/webhooks/repositories/outbox.repository';
import type { PrismaService } from '../src/modules/database/prisma.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (process.env.CI && !databaseUrl) throw new Error('TEST_DATABASE_URL is required for webhook secret integration');
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('encrypted webhook destinations in PostgreSQL', () => {
  let prisma: PrismaClient;
  let repo: WebhookRepository;
  let service: WebhooksService;
  let secrets: WebhookSecretService;
  let tenantId: string;
  let otherTenantId: string;
  let eventId: number;
  const eventCode = `webhook.secret.${randomUUID()}`;
  const startedAt = new Date(Date.now() - 24 * 60 * 60 * 1000);

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('Disposable PostgreSQL required');
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await prisma.$connect();
    tenantId = (await prisma.tenant.create({ data: { name: `secret-${randomUUID()}` } })).id;
    otherTenantId = (await prisma.tenant.create({ data: { name: `secret-${randomUUID()}` } })).id;
    eventId = (await prisma.webhookEvent.create({ data: { code: eventCode } })).id;
    repo = new WebhookRepository(prisma as PrismaService);
    secrets = new WebhookSecretService({ getOrThrow: () => ({
      webhookSignatureLegacyStartedAt: startedAt.toISOString(),
      webhookSecrets: { currentKeyVersion: 1,
        keys: { '1': Buffer.alloc(32, 5).toString('base64url') } },
    }) } as any);
    const destination = { validateNewUrl: jest.fn().mockResolvedValue(undefined),
      legacyHttpDeadline: () => null, allowsLegacyHttp: () => false } as unknown as WebhookDestinationPolicy;
    service = new WebhooksService(repo, { createEvent: jest.fn() } as unknown as OutboxRepository,
      destination, secrets);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.webhook.deleteMany({ where: { tenantId } });
    await prisma.webhookEvent.delete({ where: { id: eventId } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    await prisma.$disconnect();
  });

  it('reveals only once, encrypts at rest and rotates with one grace period', async () => {
    const created = await service.createWebhook(tenantId, {
      url: 'https://hooks.example.test/receive', eventCode,
    });
    expect(created.signingSecret).toMatch(/^whsec_[0-9a-f]{64}$/);
    const stored = await prisma.webhook.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.secret).toBeNull();
    expect(stored.secretCiphertext).not.toContain(created.signingSecret);
    expect(secrets.decrypt(tenantId, created.id, {
      ciphertext: stored.secretCiphertext!, keyVersion: stored.secretKeyVersion!,
    })).toBe(created.signingSecret);
    expect(JSON.stringify(await service.getWebhook(tenantId, created.id))).not.toContain(created.signingSecret);
    expect(JSON.stringify(await service.listWebhooks(tenantId))).not.toContain(stored.secretCiphertext);
    await expect(service.getWebhook(otherTenantId, created.id)).rejects.toThrow('Webhook not found');

    const rotated = await service.rotateSecret(tenantId, created.id);
    expect(rotated.signingSecret).not.toBe(created.signingSecret);
    const after = await prisma.webhook.findUniqueOrThrow({ where: { id: created.id } });
    expect(after.previousSecretValidUntil!.getTime() - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(secrets.decrypt(tenantId, created.id, {
      ciphertext: after.previousSecretCiphertext!, keyVersion: after.previousSecretKeyVersion!,
    })).toBe(created.signingSecret);
    await expect(service.rotateSecret(tenantId, created.id)).rejects.toThrow('grace period');
  });

  it('rotates an existing plaintext secret without exposing it in GET', async () => {
    const original = 'synthetic-legacy-secret';
    const legacy = await prisma.webhook.create({ data: {
      tenantId, eventId, url: 'https://hooks.example.test/legacy', secret: original,
      createdAt: new Date(startedAt.getTime() - 60 * 60 * 1000),
    } });
    const view = await service.getWebhook(tenantId, legacy.id);
    expect(JSON.stringify(view)).not.toContain(original);
    const rotated = await service.rotateSecret(tenantId, legacy.id);
    expect(JSON.stringify(rotated)).not.toContain(original);
    const stored = await prisma.webhook.findUniqueOrThrow({ where: { id: legacy.id } });
    expect(stored.secret).toBeNull();
    expect(secrets.decrypt(tenantId, legacy.id, {
      ciphertext: stored.previousSecretCiphertext!, keyVersion: stored.previousSecretKeyVersion!,
    })).toBe(original);
  });

  it('suspends legacy unsigned and HTTP destinations at their deadlines', async () => {
    const old = new Date(startedAt.getTime() - 60 * 60 * 1000);
    const unsigned = await prisma.webhook.create({ data: {
      tenantId, eventId, url: 'https://hooks.example.test/unsigned', createdAt: old,
    } });
    const httpId = randomUUID();
    const http = await prisma.webhook.create({ data: {
      id: httpId,
      tenantId, eventId, url: 'HTTP://hooks.example.test/legacy', createdAt: old,
      secretCiphertext: secrets.encrypt(tenantId, httpId, 'unused').ciphertext,
      secretKeyVersion: 1,
    } });
    expect(await repo.suspendExpiredUnsigned(startedAt)).toBe(1);
    expect(await repo.suspendExpiredHttp(startedAt)).toBe(1);
    expect((await prisma.webhook.findUniqueOrThrow({ where: { id: unsigned.id } })).isActive).toBe(false);
    expect((await prisma.webhook.findUniqueOrThrow({ where: { id: http.id } })).isActive).toBe(false);
  });
});
