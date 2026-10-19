import { z } from 'zod';
import { PrismaService } from '../src/modules/database/prisma.service';
import { TestimonialRepository } from '../src/modules/testimonials/repositories/testimonial.repository';
// Matches installed Prisma 6.5 TestimonialTagUncheckedCreateWithoutTestimonialInput:
// the parent relation supplies tenantId and testimonialId; only tagId is accepted here.
const nestedInput = z.array(z.object({ tagId: z.string() }).strict());
it.each(['create', 'update'] as const)(
  'sends valid nested Prisma tag inputs on %s after checking tenant ownership',
  async (operation) => {
    const row = {
      id: 'record',
      tenantId: 'tenant-a',
      createdById: null,
      authorName: 'Autor sintético',
      content: 'Contenido sintético de clasificación',
      rating: 4,
      status: { code: 'draft' },
      score: 0,
      categoryId: null,
      moderationNotes: null,
      imageUrl: null,
      videoUrl: null,
      videoTitle: null,
      videoThumbnailUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      publishedAt: null,
    };
    const write = jest.fn(
      async (args: { data: { tags: { create: unknown } } }) => {
        nestedInput.parse(args.data.tags.create);
        return row;
      },
    );
    const client = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      testimonial: { create: write, update: write },
      testimonialStatus: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
      tag: { count: jest.fn().mockResolvedValue(1) },
      outboxEvent: { create: jest.fn().mockResolvedValue({ id: 'event' }) },
    };
    const prisma = {
      ...client,
      $transaction: async (fn: (tx: typeof client) => Promise<unknown>) =>
        fn(client),
    } as unknown as PrismaService;
    const repo = new TestimonialRepository(prisma);
    if (operation === 'create')
      await expect(
        repo.createWithEvent(
          {
            tenantId: 'tenant-a',
            createdById: null,
            authorName: row.authorName,
            content: row.content,
            rating: 4,
            tagIds: ['tag-a'],
          },
          'draft',
          {
            eventType: 'testimonial.created',
            payload: () => ({ id: 'record' }),
          },
        ),
      ).resolves.toMatchObject({ id: 'record' });
    else
      await expect(
        repo.updateFields('tenant-a', 'record', { tagIds: ['tag-a'] }, 'draft'),
      ).resolves.toMatchObject({ id: 'record' });
    expect(client.tag.count).toHaveBeenCalledWith({
      where: { id: { in: ['tag-a'] }, tenantId: 'tenant-a' },
    });
  },
);
