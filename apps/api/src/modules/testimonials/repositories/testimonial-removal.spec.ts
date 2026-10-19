import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TestimonialRepository } from './testimonial.repository';

describe('testimonial removal', () => {
  function setup(activity = 0) {
    let tags = 2;
    const client = {
      analyticsEvent: { count: jest.fn().mockResolvedValue(activity) },
      testimonialTag: {
        deleteMany: jest.fn().mockImplementation(async () => {
          tags = 0;
          return { count: 2 };
        }),
      },
      testimonial: {
        deleteMany: jest.fn().mockImplementation(async () => {
          if (tags > 0 || activity > 0)
            throw new Prisma.PrismaClientKnownRequestError(
              'Synthetic foreign key constraint',
              { code: 'P2003', clientVersion: '6.5.0' },
            );
          return { count: 1 };
        }),
      },
    };
    const prisma = {
      ...client,
      $transaction: jest.fn(
        async (write: (tx: typeof client) => Promise<void>) => write(client),
      ),
    };
    return {
      repo: new TestimonialRepository(prisma as unknown as PrismaService),
      client,
    };
  }
  it('removes tag associations in the same transaction before deleting the tenant record', async () => {
    const { repo, client } = setup();
    await expect(repo.remove('tenant-a', 'record')).resolves.toBeUndefined();
    expect(client.testimonialTag.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', testimonialId: 'record' },
    });
    expect(client.testimonial.deleteMany).toHaveBeenCalledWith({
      where: { id: 'record', tenantId: 'tenant-a' },
    });
  });
  it('preserves recorded activity and does not start destructive writes', async () => {
    const { repo, client } = setup(1);
    await expect(repo.remove('tenant-a', 'record')).rejects.toMatchObject({
      kind: 'conflict',
      code: 'TESTIMONIAL_HAS_ACTIVITY',
    });
    expect(client.analyticsEvent.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a', testimonialId: 'record' },
    });
    expect(client.testimonialTag.deleteMany).not.toHaveBeenCalled();
    expect(client.testimonial.deleteMany).not.toHaveBeenCalled();
  });
});
