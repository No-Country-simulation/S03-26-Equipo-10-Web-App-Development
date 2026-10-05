import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { IdempotencyRepository, type IdempotencyRequest } from '../src/common/repositories/idempotency.repository';
import { TestimonialRepository } from '../src/modules/testimonials/repositories/testimonial.repository';
import type { PrismaService } from '../src/modules/database/prisma.service';

// Requires an isolated PostgreSQL database with the repository migrations already applied.
// This suite never migrates or connects without an explicit TEST_DATABASE_URL.
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('durable idempotency in PostgreSQL', () => {
  let first: PrismaClient;
  let second: PrismaClient;
  let tenantId: string;

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required');
    first = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    second = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await Promise.all([first.$connect(), second.$connect()]);
    await first.testimonialStatus.upsert({ where: { code: 'draft' }, create: { code: 'draft' }, update: {} });
    tenantId = (await first.tenant.create({ data: { name: `idempotency-${randomUUID()}` } })).id;
  });

  afterAll(async () => {
    if (!first) return;
    await first.idempotencyKey.deleteMany({ where: { tenantId } });
    await first.outboxEvent.deleteMany({ where: { tenantId } });
    await first.testimonial.deleteMany({ where: { tenantId } });
    await first.tenant.delete({ where: { id: tenantId } });
    await Promise.all([first.$disconnect(), second.$disconnect()]);
  });

  function request(content: string, key = randomUUID()): IdempotencyRequest {
    return {
      key, tenantId, principalKind: 'user', principalId: randomUUID(),
      method: 'POST', path: '/api/v1/testimonials',
      payload: { body: { authorName: 'Integration', content, rating: 5 } }, statusCode: 201,
    };
  }

  it('commits only one testimonial and outbox event across two clients', async () => {
    const content = `parallel-${randomUUID()}`;
    const scope = request(content);
    const serviceA = new IdempotencyRepository(first as PrismaService);
    const serviceB = new IdempotencyRepository(second as PrismaService);
    const repoA = new TestimonialRepository(first as PrismaService);
    const repoB = new TestimonialRepository(second as PrismaService);
    const create = (repo: TestimonialRepository) => async (tx?: Parameters<TestimonialRepository['createWithEvent']>[3]) => {
      if (!tx) throw new Error('Expected the idempotency transaction');
      await new Promise(resolve => setTimeout(resolve, 50));
      return repo.createWithEvent({
        tenantId, createdById: null, authorName: 'Integration', content, rating: 5,
      }, 'draft', { eventType: 'testimonial.created', payload: view => ({ id: view.id }) }, tx);
    };

    const [a, b] = await Promise.all([
      serviceA.execute(scope, create(repoA)),
      serviceB.execute(scope, create(repoB)),
    ]);
    expect(a.value.id).toBe(b.value.id);
    expect([a.replayed, b.replayed].sort()).toEqual([false, true]);
    expect(await first.testimonial.count({ where: { tenantId, content } })).toBe(1);
    expect(await first.outboxEvent.count({
      where: { tenantId, eventType: 'testimonial.created', payload: { path: ['id'], equals: a.value.id } },
    })).toBe(1);

    await expect(serviceA.execute({ ...scope, payload: { body: { content: 'different' } } }, create(repoA)))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('rolls back the reservation and mutation together on failure', async () => {
    const content = `rollback-${randomUUID()}`;
    const scope = request(content);
    const service = new IdempotencyRepository(first as PrismaService);
    const repo = new TestimonialRepository(first as PrismaService);
    await expect(service.execute(scope, async tx => {
      if (!tx) throw new Error('Expected the idempotency transaction');
      await repo.createWithEvent({
        tenantId, createdById: null, authorName: 'Integration', content, rating: 5,
      }, 'draft', { eventType: 'testimonial.created', payload: view => ({ id: view.id }) }, tx);
      throw new Error('Abort before commit');
    })).rejects.toThrow('Abort before commit');

    expect(await first.testimonial.count({ where: { tenantId, content } })).toBe(0);
    const rows = await first.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) AS count FROM "idempotency_keys"
      WHERE "tenant_id" = ${tenantId}::uuid AND "key" = ${scope.key}
    `;
    expect(rows[0]?.count).toBe(0n);
  });

  it('keeps the same key independent across actors and tenants, and replays 202', async () => {
    const key = randomUUID();
    const actorId = randomUUID();
    const tenantTwo = (await first.tenant.create({ data: { name: `idempotency-${randomUUID()}` } })).id;
    const scope: IdempotencyRequest = {
      key, tenantId, principalKind: 'user', principalId: actorId,
      method: 'POST', path: '/api/v1/webhooks/one/test', payload: { webhookId: 'one' }, statusCode: 202,
    };
    const service = new IdempotencyRepository(first as PrismaService);
    const operation = jest.fn(async () => ({ id: randomUUID(), status: 'accepted' }));
    try {
      const firstResult = await service.execute(scope, operation);
      const replay = await service.execute(scope, operation);
      const otherActor = await service.execute({ ...scope, principalId: randomUUID() }, operation);
      const otherTenant = await service.execute({ ...scope, tenantId: tenantTwo }, operation);

      expect(replay).toEqual({ value: firstResult.value, replayed: true });
      expect(otherActor.replayed).toBe(false);
      expect(otherTenant.replayed).toBe(false);
      expect(operation).toHaveBeenCalledTimes(3);
      const rows = await first.$queryRaw<Array<{ tenantId: string; principalId: string; statusCode: number }>>`
        SELECT "tenant_id" AS "tenantId", "principal_id" AS "principalId", "status_code" AS "statusCode"
        FROM "idempotency_keys" WHERE "key" = ${key}
      `;
      expect(rows).toHaveLength(3);
      expect(rows.every(row => row.statusCode === 202)).toBe(true);
      expect(new Set(rows.map(row => `${row.tenantId}:${row.principalId}`)).size).toBe(3);
    } finally {
      await first.$executeRaw`DELETE FROM "idempotency_keys" WHERE "tenant_id" = ${tenantTwo}::uuid`;
      await first.tenant.delete({ where: { id: tenantTwo } });
    }
  });
});
