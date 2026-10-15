import { TestimonialRepository } from './testimonial.repository';
import { CategoryRepository } from './category.repository';
import { TagRepository } from './tag.repository';
import { PrismaService } from '../../database/prisma.service';

describe('tenant administrative queries', () => {
  const testimonial = {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  };
  const category = {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  };
  const tag = {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  };
  const prisma = { testimonial, category, tag };
  const repo = new TestimonialRepository(prisma as unknown as PrismaService);
  beforeEach(() => jest.clearAllMocks());
  it('applies search, state, category and every tag before slicing and counting', async () => {
    await repo.findByTenant('tenant-a', {
      page: 2,
      limit: 20,
      q: 'cliente',
      status: 'pending',
      categoryId: 'category-a',
      tagIds: ['tag-a', 'tag-b'],
      sort: 'score:desc',
    });
    const args = testimonial.findMany.mock.calls[0][0];
    expect(args).toMatchObject({
      skip: 20,
      take: 20,
      orderBy: [{ score: 'desc' }, { id: 'desc' }],
      where: {
        tenantId: 'tenant-a',
        status: { code: 'pending' },
        categoryId: 'category-a',
        OR: [
          { authorName: { contains: 'cliente', mode: 'insensitive' } },
          { content: { contains: 'cliente', mode: 'insensitive' } },
        ],
        AND: [
          { tags: { some: { tenantId: 'tenant-a', tagId: 'tag-a' } } },
          { tags: { some: { tenantId: 'tenant-a', tagId: 'tag-b' } } },
        ],
      },
    });
    expect(testimonial.count).toHaveBeenCalledWith({ where: args.where });
  });
  it('retains stable recent ordering for legacy clients', async () => {
    await repo.findByTenant('tenant-a');
    expect(testimonial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-a' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
        skip: 0,
      }),
    );
  });
  it.each(['category', 'tag'] as const)(
    'searches %s independently and counts associations across the tenant',
    async (kind) => {
      const catalog =
        kind === 'category'
          ? new CategoryRepository(prisma as unknown as PrismaService)
          : new TagRepository(prisma as unknown as PrismaService);
      await catalog.findByTenant('tenant-a', {
        page: 1,
        limit: 20,
        q: 'cohorte',
      });
      expect(
        (kind === 'category' ? category : tag).findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-a',
            name: { contains: 'cohorte', mode: 'insensitive' },
          },
          include: {
            _count: {
              select: {
                testimonials: {
                  where: expect.objectContaining({ tenantId: 'tenant-a' }),
                },
              },
            },
          },
        }),
      );
    },
  );
});

describe('tenant summary', () => {
  it('uses filtered association counts for every status, including empty states', async () => {
    const statuses = {
      findMany: jest.fn().mockResolvedValue([
        { code: 'draft', _count: { testimonials: 4 } },
        { code: 'pending', _count: { testimonials: 30 } },
        { code: 'published', _count: { testimonials: 21 } },
      ]),
    };
    const repo = new TestimonialRepository({
      testimonialStatus: statuses,
    } as unknown as PrismaService);
    expect(await repo.summarize('tenant-a')).toEqual({
      total: 55,
      byStatus: {
        draft: 4,
        pending: 30,
        approved: 0,
        published: 21,
        rejected: 0,
      },
    });
    expect(statuses.findMany).toHaveBeenCalledWith({
      select: {
        code: true,
        _count: {
          select: { testimonials: { where: { tenantId: 'tenant-a' } } },
        },
      },
    });
  });
});
