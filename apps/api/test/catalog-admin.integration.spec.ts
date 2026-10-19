import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/modules/database/prisma.service';
import { CategoryRepository } from '../src/modules/testimonials/repositories/category.repository';
import { TagRepository } from '../src/modules/testimonials/repositories/tag.repository';
import { UserRepository } from '../src/modules/users/repositories/user.repository';
import { CredentialRepository } from '../src/common/repositories/credential.repository';
const url = process.env.TEST_DATABASE_URL;
if (process.env.CI && !url)
  throw new Error('TEST_DATABASE_URL is required in CI');
const describeDatabase = url ? describe : describe.skip;
// Only run against an explicitly verified disposable PostgreSQL database.
describeDatabase('catalog and user administration in PostgreSQL', () => {
  let prisma: PrismaClient;
  let tenant: string,
    foreignTenant: string,
    category: string,
    foreignCategory: string,
    tag: string,
    foreignTag: string,
    testimonial: string,
    foreignTestimonial: string,
    user: string,
    foreignUser: string;
  let categories: CategoryRepository,
    tags: TagRepository,
    users: UserRepository,
    credentials: CredentialRepository;
  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: url! } } });
    await prisma.$connect();
    tenant = (
      await prisma.tenant.create({
        data: { name: `catalog-admin-${randomUUID()}` },
      })
    ).id;
    foreignTenant = (
      await prisma.tenant.create({
        data: { name: `catalog-admin-${randomUUID()}` },
      })
    ).id;
    const status = await prisma.testimonialStatus.upsert({
      where: { code: 'draft' },
      update: {},
      create: { code: 'draft' },
    });
    const role = await prisma.role.upsert({
      where: { code: 'editor' },
      update: {},
      create: { code: 'editor' },
    });
    for (const id of [tenant, foreignTenant]) {
      const cat = await prisma.category.create({
        data: { tenantId: id, name: 'Clasificación de integración' },
      });
      const label = await prisma.tag.create({
        data: { tenantId: id, name: 'Etiqueta de integración' },
      });
      const account = await prisma.user.create({
        data: {
          tenantId: id,
          email: `fixture-${randomUUID()}@example.invalid`,
          passwordHash: 'unusable-test-fixture',
          roles: { create: { roleId: role.id } },
        },
      });
      const record = await prisma.testimonial.create({
        data: {
          tenantId: id,
          authorName: 'Autor sintético',
          content: 'Testimonio de integración de clasificaciones',
          rating: 4,
          statusId: status.id,
          categoryId: cat.id,
          createdById: account.id,
          tags: { create: { tagId: label.id } },
        },
      });
      if (id === tenant) {
        category = cat.id;
        tag = label.id;
        testimonial = record.id;
        user = account.id;
      } else {
        foreignCategory = cat.id;
        foreignTag = label.id;
        foreignTestimonial = record.id;
        foreignUser = account.id;
      }
    }
    categories = new CategoryRepository(prisma as PrismaService);
    tags = new TagRepository(prisma as PrismaService);
    users = new UserRepository(prisma as PrismaService);
    credentials = new CredentialRepository(prisma as PrismaService);
  });
  afterAll(async () => {
    if (!prisma) return;
    const ids = [tenant, foreignTenant].filter(Boolean);
    await prisma.testimonialTag.deleteMany({
      where: { tenantId: { in: ids } },
    });
    await prisma.testimonial.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.tag.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.category.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.refreshSession.deleteMany({
      where: {
        userId: { in: [user, foreignUser].filter(Boolean) },
        user: { tenantId: { in: ids } },
      },
    });
    await prisma.user.deleteMany({ where: { tenantId: { in: ids } } });
    await prisma.tenant.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });
  it('renames and deletes classifications while preserving testimonials and foreign tenant associations', async () => {
    await expect(
      categories.remove(foreignTenant, category),
    ).rejects.toMatchObject({ kind: 'not_found' });
    await expect(tags.remove(foreignTenant, tag)).rejects.toMatchObject({
      kind: 'not_found',
    });
    await categories.update(tenant, category, 'Nombre renombrado');
    await tags.update(tenant, tag, 'Etiqueta renombrada');
    expect(
      (
        await categories.findByTenant(tenant, {
          page: 1,
          limit: 20,
          q: 'renombrado',
        })
      ).items,
    ).toEqual([expect.objectContaining({ id: category, testimonialCount: 1 })]);
    expect(
      (await tags.findByTenant(tenant, { page: 1, limit: 20, q: 'renombrada' }))
        .items,
    ).toEqual([expect.objectContaining({ id: tag, testimonialCount: 1 })]);
    await categories.remove(tenant, category);
    await tags.remove(tenant, tag);
    expect(
      await prisma.testimonial.findFirst({
        where: { id: testimonial, tenantId: tenant },
      }),
    ).toMatchObject({ id: testimonial, categoryId: null });
    expect(
      await prisma.testimonialTag.count({
        where: { tenantId: tenant, testimonialId: testimonial },
      }),
    ).toBe(0);
    expect(
      await prisma.testimonial.findFirst({
        where: { id: foreignTestimonial, tenantId: foreignTenant },
      }),
    ).toMatchObject({ categoryId: foreignCategory });
    expect(
      await prisma.testimonialTag.count({
        where: {
          tenantId: foreignTenant,
          testimonialId: foreignTestimonial,
          tagId: foreignTag,
        },
      }),
    ).toBe(1);
  });
  it('rejects inactive credentials, restores access on activation and refuses foreign tenant writes', async () => {
    await users.update({ tenantId: tenant, userId: user, isActive: false });
    expect(await credentials.findActiveUser(user)).toBeNull();
    await expect(
      users.update({ tenantId: foreignTenant, userId: user, isActive: true }),
    ).rejects.toMatchObject({ kind: 'not_found' });
    expect(await credentials.findActiveUser(user)).toBeNull();
    expect(await credentials.findActiveUser(foreignUser)).not.toBeNull();
    await users.update({ tenantId: tenant, userId: user, isActive: true });
    expect(await credentials.findActiveUser(user)).toMatchObject({
      tenantId: tenant,
      roles: ['editor'],
      isActive: true,
    });
  });
  it('preserves a user, ownership and session history when deletion is restricted', async () => {
    const session = await prisma.refreshSession.create({
      data: { userId: user, expiresAt: new Date(Date.now() + 60000) },
    });
    await expect(users.remove(tenant, user)).rejects.toMatchObject({
      kind: 'conflict',
      code: 'USER_HAS_HISTORY',
    });
    expect(
      await prisma.user.findFirst({ where: { id: user, tenantId: tenant } }),
    ).not.toBeNull();
    expect(
      await prisma.testimonial.findFirst({
        where: { id: testimonial, tenantId: tenant },
      }),
    ).toMatchObject({ createdById: user });
    expect(
      await prisma.refreshSession.count({
        where: { id: session.id, userId: user, user: { tenantId: tenant } },
      }),
    ).toBe(1);
  });
});
