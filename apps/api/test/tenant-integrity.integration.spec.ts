import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/modules/database/prisma.service';
import { CategoryRepository } from '../src/modules/testimonials/repositories/category.repository';
import { UserRepository } from '../src/modules/users/repositories/user.repository';

// Requires a disposable PostgreSQL 18 database with all migrations applied.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (process.env.CI && !testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required in CI for tenant integrity tests');
}
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('tenant integrity in PostgreSQL', () => {
  let prisma: PrismaClient;
  let tenantId: string;
  let otherTenantId: string;
  let statusId: number;
  let eventTypeId: number;
  let webhookEventId: number;
  let webhookEventCode: string;
  const tenantIds: string[] = [];

  async function testimonial(content = 'Valid testimonial content') {
    return prisma.testimonial.create({ data: {
      tenantId, content, authorName: 'Synthetic', rating: 5, statusId,
    } });
  }

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required');
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await prisma.$connect();
    const [tenant, otherTenant] = await Promise.all([
      prisma.tenant.create({ data: { name: `integrity-${randomUUID()}` } }),
      prisma.tenant.create({ data: { name: `integrity-${randomUUID()}` } }),
    ]);
    tenantId = tenant.id;
    otherTenantId = otherTenant.id;
    tenantIds.push(tenantId, otherTenantId);
    statusId = (await prisma.testimonialStatus.upsert({
      where: { code: 'draft' }, create: { code: 'draft' }, update: {},
    })).id;
    eventTypeId = (await prisma.analyticsEventType.upsert({
      where: { code: 'view' }, create: { code: 'view' }, update: {},
    })).id;
    webhookEventCode = `integrity.${randomUUID()}`;
    webhookEventId = (await prisma.webhookEvent.create({ data: { code: webhookEventCode } })).id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.webhookDeliveryAttempt.deleteMany({ where: { delivery: { tenantId: { in: tenantIds } } } });
    await prisma.webhookDelivery.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.outboxEvent.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.webhook.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.analyticsEvent.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.testimonialTag.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.testimonial.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.apiKeyCredential.deleteMany({ where: { apiKey: { tenantId: { in: tenantIds } } } });
    await prisma.apiKey.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tag.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.category.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    if (webhookEventCode) await prisma.webhookEvent.delete({ where: { code: webhookEventCode } });
    await prisma.$disconnect();
  });

  it('rejects foreign categories and authors via Prisma and direct SQL', async () => {
    const category = await prisma.category.create({ data: { tenantId: otherTenantId, name: `foreign-${randomUUID()}` } });
    const user = await prisma.user.create({ data: {
      tenantId: otherTenantId, email: `foreign-${randomUUID()}@example.test`, passwordHash: 'synthetic',
    } });
    await expect(prisma.testimonial.create({ data: {
      tenantId, categoryId: category.id, content: 'Valid foreign category', authorName: 'Synthetic', rating: 5, statusId,
    } })).rejects.toThrow();
    await expect(prisma.$executeRaw`
      INSERT INTO testimonials (tenant_id, content, author_name, rating, status_id, created_by_id)
      VALUES (${tenantId}::uuid, 'Valid foreign author', 'Synthetic', 5, ${statusId}, ${user.id}::uuid)
    `).rejects.toThrow();
    expect(await prisma.testimonial.count({ where: { tenantId, content: { in: ['Valid foreign category', 'Valid foreign author'] } } })).toBe(0);
  });

  it('rejects cross-tenant tags and analytics events', async () => {
    const own = await testimonial();
    const ownTag = await prisma.tag.create({ data: { tenantId, name: `owned-${randomUUID()}` } });
    const foreignTag = await prisma.tag.create({ data: { tenantId: otherTenantId, name: `foreign-${randomUUID()}` } });
    const foreignTestimonial = await prisma.testimonial.create({ data: {
      tenantId: otherTenantId, content: 'Foreign valid content', authorName: 'Synthetic', rating: 5, statusId,
    } });
    await expect(prisma.testimonialTag.create({ data: {
      tenantId, testimonialId: own.id, tagId: foreignTag.id,
    } })).rejects.toThrow();
    await expect(prisma.$executeRaw`
      INSERT INTO testimonial_tags (tenant_id, testimonial_id, tag_id)
      VALUES (${otherTenantId}::uuid, ${own.id}::uuid, ${foreignTag.id}::uuid)
    `).rejects.toThrow();
    await expect(prisma.analyticsEvent.create({ data: {
      tenantId, testimonialId: foreignTestimonial.id, eventTypeId,
    } })).rejects.toThrow();
    await expect(prisma.$executeRaw`
      INSERT INTO analytics_events (tenant_id, testimonial_id, event_type_id)
      VALUES (${otherTenantId}::uuid, ${own.id}::uuid, ${eventTypeId})
    `).rejects.toThrow();
    await prisma.testimonialTag.create({ data: { tenantId, testimonialId: own.id, tagId: ownTag.id } });
    expect(await prisma.testimonialTag.count({ where: { testimonialId: own.id } })).toBe(1);
    expect(await prisma.analyticsEvent.count({ where: { testimonialId: own.id } })).toBe(0);
  });

  it('rejects foreign API-key owners and mismatched webhook deliveries', async () => {
    const user = await prisma.user.create({ data: {
      tenantId: otherTenantId, email: `foreign-${randomUUID()}@example.test`, passwordHash: 'synthetic',
    } });
    const webhook = await prisma.webhook.create({ data: {
      tenantId, eventId: webhookEventId, url: 'https://example.test/hook',
    } });
    const foreignEvent = await prisma.outboxEvent.create({ data: {
      tenantId: otherTenantId, eventType: webhookEventCode, payload: {},
    } });
    await expect(prisma.apiKey.create({ data: {
      tenantId, ownerId: user.id, name: 'invalid-owner',
    } })).rejects.toThrow();
    await expect(prisma.$executeRaw`
      INSERT INTO api_keys (tenant_id, owner_id, name, status)
      VALUES (${tenantId}::uuid, ${user.id}::uuid, 'invalid-owner-sql', 'ACTIVE')
    `).rejects.toThrow();
    await expect(prisma.webhookDelivery.create({ data: {
      tenantId, webhookId: webhook.id, outboxEventId: foreignEvent.id,
      destinationUrl: webhook.url, status: 'pending',
    } })).rejects.toThrow();
    await expect(prisma.$executeRaw`
      INSERT INTO webhook_deliveries (tenant_id, webhook_id, outbox_event_id, destination_url, status)
      VALUES (${otherTenantId}::uuid, ${webhook.id}::uuid, ${foreignEvent.id}::uuid, 'https://example.test/hook', 'pending')
    `).rejects.toThrow();
    expect(await prisma.apiKey.count({ where: { tenantId, name: { startsWith: 'invalid-owner' } } })).toBe(0);
    expect(await prisma.webhookDelivery.count({ where: { webhookId: webhook.id } })).toBe(0);
  });

  it('rejects nine characters and accepts ten with optional relations unset', async () => {
    await expect(testimonial('123456789')).rejects.toThrow();
    await expect(testimonial('😀'.repeat(5))).rejects.toThrow();
    await expect(prisma.$executeRaw`
      INSERT INTO testimonials (tenant_id, content, author_name, rating, status_id)
      VALUES (${tenantId}::uuid, '123456789', 'Synthetic', 5, ${statusId})
    `).rejects.toThrow();
    const valid = await testimonial('1234567890');
    await testimonial('😀'.repeat(10));
    expect(valid.categoryId).toBeNull();
    expect(valid.createdById).toBeNull();
    const key = await prisma.apiKey.create({ data: { tenantId, name: 'owner-optional' } });
    expect(key.ownerId).toBeNull();
    const webhook = await prisma.webhook.create({ data: {
      tenantId, eventId: webhookEventId, url: 'https://example.test/optional',
    } });
    const delivery = await prisma.webhookDelivery.create({ data: {
      tenantId, webhookId: webhook.id, destinationUrl: webhook.url, status: 'pending',
    } });
    expect(delivery.outboxEventId).toBeNull();
    expect(await prisma.testimonial.count({ where: { tenantId, content: '123456789' } })).toBe(0);
  });

  it('detaches optional relationships before deleting categories and users', async () => {
    const category = await prisma.category.create({ data: { tenantId, name: `owned-${randomUUID()}` } });
    const user = await prisma.user.create({ data: {
      tenantId, email: `owned-${randomUUID()}@example.test`, passwordHash: 'synthetic',
    } });
    const row = await prisma.testimonial.create({ data: {
      tenantId, categoryId: category.id, createdById: user.id,
      content: 'Valid owned testimonial', authorName: 'Synthetic', rating: 5, statusId,
    } });
    const key = await prisma.apiKey.create({ data: { tenantId, ownerId: user.id, name: 'owned-key' } });
    await new CategoryRepository(prisma as PrismaService).remove(tenantId, category.id);
    await new UserRepository(prisma as PrismaService).remove(tenantId, user.id);
    expect(await prisma.testimonial.findUnique({ where: { id: row.id } })).toMatchObject({
      categoryId: null, createdById: null,
    });
    expect(await prisma.apiKey.findUnique({ where: { id: key.id } })).toMatchObject({ ownerId: null });
  });
});
