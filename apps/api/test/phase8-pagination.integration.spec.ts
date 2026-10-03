import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { CategoryRepository } from '../src/modules/testimonials/repositories/category.repository';
import { CategoriesService } from '../src/modules/testimonials/services/categories.service';
import { PrismaService } from '../src/modules/database/prisma.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (process.env.CI && !databaseUrl) throw new Error('TEST_DATABASE_URL is required in CI');
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('administrative pagination in PostgreSQL', () => {
  let prisma: PrismaClient;
  let ownTenant: string;
  let otherTenant: string;
  let service: CategoriesService;

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
    await prisma.$connect();
    ownTenant = (await prisma.tenant.create({ data: { name: `pagination-${randomUUID()}` } })).id;
    otherTenant = (await prisma.tenant.create({ data: { name: `pagination-${randomUUID()}` } })).id;
    service = new CategoriesService(new CategoryRepository(prisma as PrismaService));
    for (const name of ['A', 'B', 'C']) await prisma.category.create({ data: { tenantId: ownTenant, name } });
    await prisma.category.create({ data: { tenantId: otherTenant, name: 'Other tenant' } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.category.deleteMany({ where: { tenantId: { in: [ownTenant, otherTenant] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [ownTenant, otherTenant] } } });
    await prisma.$disconnect();
  });

  it('returns stable tenant-scoped pages and counts without exposing another tenant', async () => {
    const first = await service.list(ownTenant, { page: 1, limit: 2 });
    const second = await service.list(ownTenant, { page: 2, limit: 2 });
    expect(first.meta).toEqual({ total: 3, page: 1, limit: 2 });
    expect(first.items.map(item => item.name)).toEqual(['A', 'B']);
    expect(second.items.map(item => item.name)).toEqual(['C']);
    expect(second.items.every(item => item.tenantId === ownTenant)).toBe(true);
    expect((await service.list(otherTenant, { page: 1, limit: 2 })).meta.total).toBe(1);
  });
});
