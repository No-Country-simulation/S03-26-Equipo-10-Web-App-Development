import { ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/modules/database/prisma.service';
import { TestimonialRepository } from '../src/modules/testimonials/repositories/testimonial.repository';
import { AnalyticsRepository } from '../src/modules/analytics/repositories/analytics.repository';

// Requires a disposable PostgreSQL database with the repository migrations applied.
// Set TEST_DATABASE_URL explicitly; this suite never modifies a developer database by default.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (process.env.CI && !testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required in CI so PostgreSQL integration tests cannot be skipped');
}
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('testimonial persistence with PostgreSQL', () => {
  let prisma: PrismaClient;
  let repo: TestimonialRepository;
  let tenantId: string;
  let otherTenantId: string;

  const data = () => ({
    tenantId,
    createdById: null,
    authorName: 'Integration test',
    content: 'A sufficiently long testimonial',
    rating: 5,
  });

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required');
    prisma = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await prisma.$connect();
    for (const code of ['draft', 'pending', 'approved', 'published', 'rejected']) {
      await prisma.testimonialStatus.upsert({ where: { code }, create: { code }, update: {} });
    }
    const tenant = await prisma.tenant.create({ data: { name: `integration-${randomUUID()}` } });
    const otherTenant = await prisma.tenant.create({ data: { name: `integration-${randomUUID()}` } });
    tenantId = tenant.id;
    otherTenantId = otherTenant.id;
    repo = new TestimonialRepository(prisma as PrismaService);
  });

  afterAll(async () => {
    if (!prisma) return;
    if (tenantId) {
      await prisma.outboxEvent.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await prisma.testimonialTag.deleteMany({ where: { testimonial: { tenantId: { in: [tenantId, otherTenantId] } } } });
      await prisma.testimonial.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await prisma.tag.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    }
    await prisma.$disconnect();
  });

  it('commits a pending public testimonial and its matching outbox event', async () => {
    const created = await repo.createWithEvent(data(), 'pending', {
      eventType: 'testimonial.created',
      payload: view => ({ id: view.id, status: view.status, source: 'public_form' }),
    });
    const event = await prisma.outboxEvent.findFirst({
      where: { tenantId, eventType: 'testimonial.created', payload: { path: ['id'], equals: created.id } },
    });

    expect(created.status).toBe('pending');
    expect(event?.payload).toMatchObject({ id: created.id, status: 'pending', source: 'public_form' });
  });

  it('rolls back a testimonial when the outbox insert fails', async () => {
    const marker = `rollback-${randomUUID()}`;
    await expect(repo.createWithEvent({ ...data(), content: marker }, 'pending', {
      eventType: 'testimonial.created',
      payload: () => ({ invalidJson: BigInt(1) }),
    })).rejects.toThrow();

    expect(await prisma.testimonial.count({ where: { tenantId, content: marker } })).toBe(0);
  });

  it('rolls back publication when its outbox insert fails', async () => {
    const created = await repo.createWithEvent(data(), 'draft', {
      eventType: 'testimonial.created', payload: view => ({ id: view.id }),
    });
    await repo.updateStatus(tenantId, created.id, 'draft', 'pending');
    await repo.updateStatus(tenantId, created.id, 'pending', 'approved');

    await expect(repo.updateStatus(tenantId, created.id, 'approved', 'published', { publishedAt: new Date() }, {
      eventType: 'testimonial.published', payload: () => ({ invalidJson: BigInt(1) }),
    })).rejects.toThrow();

    expect((await repo.findById(tenantId, created.id))?.status).toBe('approved');
    expect(await prisma.outboxEvent.count({ where: { tenantId, eventType: 'testimonial.published', payload: { path: ['id'], equals: created.id } } })).toBe(0);
  });

  it('rejects cross-tenant writes and associations', async () => {
    const created = await repo.createWithEvent(data(), 'draft', {
      eventType: 'testimonial.created', payload: view => ({ id: view.id }),
    });
    const foreignTag = await prisma.tag.create({ data: { tenantId: otherTenantId, name: `foreign-${randomUUID()}` } });

    await expect(repo.updateStatus(otherTenantId, created.id, 'draft', 'pending')).rejects.toThrow(ConflictException);
    await expect(repo.updateFields(otherTenantId, created.id, { content: 'Intrusion' }, 'draft')).rejects.toThrow();
    await expect(repo.updateMedia(otherTenantId, created.id, 'draft', { imageUrl: 'https://example.com/x' })).rejects.toThrow();
    await expect(repo.updateFields(tenantId, created.id, { tagIds: [foreignTag.id] }, 'draft')).rejects.toThrow();
    await expect(new AnalyticsRepository(prisma as PrismaService).trackEvent(otherTenantId, {
      eventType: 'view', testimonialId: created.id,
    })).rejects.toThrow();
    expect((await repo.findById(tenantId, created.id))?.content).toBe(data().content);
  });

  it('allows only one concurrent transition from the expected state', async () => {
    const created = await repo.createWithEvent(data(), 'draft', {
      eventType: 'testimonial.created', payload: view => ({ id: view.id }),
    });
    const results = await Promise.allSettled([
      repo.updateStatus(tenantId, created.id, 'draft', 'pending'),
      repo.updateStatus(tenantId, created.id, 'draft', 'pending'),
    ]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect((await repo.findById(tenantId, created.id))?.status).toBe('pending');
  });
});
