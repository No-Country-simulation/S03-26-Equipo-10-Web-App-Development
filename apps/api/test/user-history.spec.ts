import { Prisma } from '@prisma/client';
import { UserRepository } from '../src/modules/users/repositories/user.repository';
import { PrismaService } from '../src/modules/database/prisma.service';
it('preserves history on a restricted user deletion and reports a usable conflict', async () => {
  const tx = {
    testimonial: { updateMany: jest.fn() },
    apiKey: { updateMany: jest.fn() },
    user: {
      deleteMany: jest
        .fn()
        .mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError(
            'Synthetic restricted history',
            { code: 'P2003', clientVersion: '6.5.0' },
          ),
        ),
    },
  };
  const repo = new UserRepository({
    $transaction: async (fn: (client: typeof tx) => Promise<void>) => fn(tx),
  } as unknown as PrismaService);
  await expect(repo.remove('tenant-a', 'other-user')).rejects.toMatchObject({
    kind: 'conflict',
    code: 'USER_HAS_HISTORY',
  });
});
