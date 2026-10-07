import { Prisma } from '@prisma/client';
import { PublicTestimonialsQueryDto } from '../src/modules/testimonials/dto/testimonial.dto';
import { parseYoutubeUrl } from '../src/modules/shared/cloud/parse-youtube-url';
import { UserRepository } from '../src/modules/users/repositories/user.repository';
import { TestimonialRepository } from '../src/modules/testimonials/repositories/testimonial.repository';
import type { PrismaService } from '../src/modules/database/prisma.service';

describe('public API boundaries', () => {
  it.each([
    'https://youtu.be/dQw4w9WgXcQ',
    'https://youtube.com/watch?v=dQw4w9WgXcQ&t=4',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
  ])('canonicalizes an accepted YouTube URL: %s', value => {
    expect(parseYoutubeUrl(value)).toEqual({
      videoId: 'dQw4w9WgXcQ',
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
  });

  it.each([
    'https://example.com/youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'http://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://user:pass@youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/embed/dQw4w9WgXcQ',
    'https://youtube.com/watch?v=short',
    'https://youtube.com/watch?v=dQw4w9WgXcQ&v=another1234',
    'https://youtu.be/dQw4w9WgXcQ/extra',
  ])('rejects an unsupported YouTube URL: %s', value => {
    expect(() => parseYoutubeUrl(value)).toThrow();
  });

  it('parses bounded public pagination into integers', () => {
    expect(PublicTestimonialsQueryDto.schema.parse({})).toEqual({});
    expect(PublicTestimonialsQueryDto.schema.parse({ page: '10000', limit: '100', q: 'x' })).toEqual({
      page: 10_000, limit: 100, q: 'x',
    });
  });

  it.each([
    { page: '0' }, { page: '-1' }, { page: '1.5' }, { page: ['1', '2'] },
    { page: '10001' }, { page: '9007199254740993' }, { limit: '0' },
    { limit: '101' }, { limit: ['1'] }, { q: 'q'.repeat(201) },
    { tag: 't'.repeat(81) }, { category: 'c'.repeat(81) },
  ])('rejects invalid public list parameters: %j', query => {
    expect(PublicTestimonialsQueryDto.schema.safeParse(query).success).toBe(false);
  });
});

describe('conditional tenant writes', () => {
  const missing = new Prisma.PrismaClientKnownRequestError('Record not found', {
    code: 'P2025', clientVersion: '6.5.0',
  });

  it('maps a user disappearing during update to not found', async () => {
    const update = jest.fn().mockRejectedValue(missing);
    const repo = new UserRepository({ user: { update } } as unknown as PrismaService);
    await expect(repo.update({ tenantId: 'tenant-a', userId: 'user-a', isActive: false }))
      .rejects.toMatchObject({ kind: 'not_found' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'user-a', tenantId: 'tenant-a' },
    }));
  });

  it('returns the updated user instead of a nullable follow-up read', async () => {
    const user = {
      id: 'user-a', tenantId: 'tenant-a', email: 'user@example.com', isActive: false,
      roles: [{ role: { code: 'editor' } }], createdAt: new Date(), updatedAt: new Date(),
    };
    const update = jest.fn().mockResolvedValue(user);
    const repo = new UserRepository({ user: { update } } as unknown as PrismaService);

    await expect(repo.update({ tenantId: 'tenant-a', userId: 'user-a', isActive: false }))
      .resolves.toMatchObject({ id: 'user-a', isActive: false, roles: ['editor'] });
  });

  it('does not claim a user deletion when no scoped row was removed', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const tx = {
      testimonial: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      apiKey: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      user: { deleteMany },
    };
    const prisma = {
      $transaction: (work: (client: typeof tx) => Promise<void>) => work(tx),
    } as unknown as PrismaService;
    const repo = new UserRepository(prisma);
    await expect(repo.remove('tenant-a', 'user-a')).rejects.toMatchObject({ kind: 'not_found' });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'user-a', tenantId: 'tenant-a' } });
  });

  it('distinguishes a missing testimonial from a changed status during update', async () => {
    const findFirst = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'one' });
    const prisma = {
      testimonialStatus: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
      testimonial: { update: jest.fn().mockRejectedValue(missing), findFirst },
    } as unknown as PrismaService;
    const repo = new TestimonialRepository(prisma);

    await expect(repo.updateFields('tenant-a', 'one', { content: 'Enough content here' }, 'draft'))
      .rejects.toMatchObject({ kind: 'not_found' });
    await expect(repo.updateFields('tenant-a', 'one', { content: 'Enough content here' }, 'draft'))
      .rejects.toMatchObject({ kind: 'conflict' });
    expect(findFirst).toHaveBeenCalledWith({ where: { id: 'one', tenantId: 'tenant-a' }, select: { id: true } });
  });

  it('maps a testimonial disappearing during media update to not found', async () => {
    const prisma = {
      testimonialStatus: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
      testimonial: {
        update: jest.fn().mockRejectedValue(missing),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const repo = new TestimonialRepository(prisma);

    await expect(repo.updateMedia('tenant-a', 'one', 'pending', { imageUrl: 'https://example.com/image' }))
      .rejects.toMatchObject({ kind: 'not_found' });
  });

  it.each([
    { existing: null, kind: 'not_found' },
    { existing: { id: 'one' }, kind: 'conflict' },
  ])('distinguishes a missing testimonial from a status race: $kind', async ({ existing, kind }) => {
    const tx = {
      testimonialStatus: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
      testimonial: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(existing),
      },
    };
    const prisma = {
      $transaction: (work: (client: typeof tx) => Promise<unknown>) => work(tx),
    } as unknown as PrismaService;
    const repo = new TestimonialRepository(prisma);

    await expect(repo.updateStatus('tenant-a', 'one', 'pending', 'approved'))
      .rejects.toMatchObject({ kind });
    expect(tx.testimonial.findFirst).toHaveBeenCalledWith({
      where: { id: 'one', tenantId: 'tenant-a' }, select: { id: true },
    });
  });

  it('does not claim a testimonial deletion when no scoped row was removed', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const repo = new TestimonialRepository({ testimonial: { deleteMany } } as unknown as PrismaService);
    await expect(repo.remove('tenant-a', 'one')).rejects.toMatchObject({ kind: 'not_found' });
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'one', tenantId: 'tenant-a' } });
  });
});
