import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/modules/database/prisma.service';
import { TagRepository } from '../src/modules/testimonials/repositories/tag.repository';

describe('tag removal integrity', () => {
  it('removes only tenant associations before deleting the tag', async () => {
    let linked = true;
    const client = {
      testimonialTag: {
        deleteMany: jest.fn(async () => {
          linked = false;
          return { count: 2 };
        }),
      },
      tag: {
        delete: jest.fn(async () => {
          if (linked)
            throw new Prisma.PrismaClientKnownRequestError('Synthetic FK', {
              code: 'P2003',
              clientVersion: '6.5.0',
            });
          return {};
        }),
      },
    };
    const prisma = {
      ...client,
      $transaction: jest.fn(async (fn: (tx: typeof client) => Promise<void>) =>
        fn(client),
      ),
    };
    await expect(
      new TagRepository(prisma as unknown as PrismaService).remove(
        'tenant-a',
        'tag-a',
      ),
    ).resolves.toBeUndefined();
    expect(client.testimonialTag.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', tagId: 'tag-a' },
    });
    expect(client.tag.delete).toHaveBeenCalledWith({
      where: { id: 'tag-a', tenantId: 'tenant-a' },
    });
  });
});

import { CategoriesService } from '../src/modules/testimonials/services/categories.service';
import { CategoryRepository } from '../src/modules/testimonials/repositories/category.repository';
import { TagsService } from '../src/modules/testimonials/services/tags.service';
import { TestimonialRepository } from '../src/modules/testimonials/repositories/testimonial.repository';
import { CacheService } from '../src/common/services/cache.service';

describe('catalog mutation responses', () => {
  it.each(['categories', 'tags'] as const)(
    'invalidates public tenant cache after renaming %s',
    async (kind) => {
      const row = { id: 'one', tenantId: 'tenant-a', name: 'Nuevo nombre' };
      const repo = {
        findById: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue(row),
      };
      const cache = {
        invalidateTenantPublic: jest.fn().mockResolvedValue(undefined),
      };
      const service =
        kind === 'categories'
          ? new CategoriesService(
              repo as unknown as CategoryRepository,
              cache as unknown as CacheService,
            )
          : new TagsService(
              repo as unknown as TagRepository,
              {} as TestimonialRepository,
              cache as unknown as CacheService,
            );
      await expect(
        service.update('tenant-a', 'one', { name: 'Nuevo nombre' }),
      ).resolves.toEqual(row);
      expect(cache.invalidateTenantPublic).toHaveBeenCalledWith('tenant-a');
    },
  );
  it.each(['categories', 'tags'] as const)(
    'reports duplicate %s as a conflict',
    async (kind) => {
      const duplicate = new Prisma.PrismaClientKnownRequestError(
        'Synthetic duplicate',
        { code: 'P2002', clientVersion: '6.5.0' },
      );
      const delegate = {
        create: jest.fn().mockRejectedValue(duplicate),
        update: jest.fn().mockRejectedValue(duplicate),
      };
      const prisma = {
        category: delegate,
        tag: delegate,
      } as unknown as PrismaService;
      const repo =
        kind === 'categories'
          ? new CategoryRepository(prisma)
          : new TagRepository(prisma);
      await expect(repo.create('tenant-a', 'Duplicado')).rejects.toMatchObject({
        kind: 'conflict',
        code: 'CATALOG_NAME_TAKEN',
      });
      await expect(
        repo.update('tenant-a', 'one', 'Duplicado'),
      ).rejects.toMatchObject({ kind: 'conflict', code: 'CATALOG_NAME_TAKEN' });
    },
  );
});
