import { Prisma } from '@prisma/client';
import { UserRepository } from '../src/modules/users/repositories/user.repository';
import { PrismaService } from '../src/modules/database/prisma.service';

const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('Synthetic database error', {
    code,
    clientVersion: '6.5.0',
  });
const connectorError = (code: string) =>
  new Prisma.PrismaClientUnknownRequestError(
    `ConnectorError(ConnectorError { kind: QueryError(PostgresError { code: "${code}", message: "Synthetic restricted history" }) })`,
    { clientVersion: '6.5.0' },
  );

function repositoryFailingDeletion(error: unknown) {
  const tx = {
    testimonial: { updateMany: jest.fn() },
    apiKey: { updateMany: jest.fn() },
    user: { deleteMany: jest.fn().mockRejectedValue(error) },
  };
  return new UserRepository({
    $transaction: async (fn: (client: typeof tx) => Promise<void>) => fn(tx),
  } as unknown as PrismaService);
}

it.each([
  ['Prisma P2003', knownError('P2003')],
  ['PostgreSQL RESTRICT surfaced by Prisma 6.5', connectorError('23001')],
])('reports a usable history conflict for %s', async (_label, error) => {
  await expect(
    repositoryFailingDeletion(error).remove('tenant-a', 'other-user'),
  ).rejects.toMatchObject({ kind: 'conflict', code: 'USER_HAS_HISTORY' });
});

it.each([
  ['another known Prisma failure', knownError('P2002')],
  ['another PostgreSQL failure', connectorError('23514')],
  [
    'an unclassified Prisma message mentioning the number',
    new Prisma.PrismaClientUnknownRequestError('Synthetic failure 23001', {
      clientVersion: '6.5.0',
    }),
  ],
  [
    'an error outside the Prisma connector',
    new Error('PostgresError { code: "23001" }'),
  ],
])(
  'preserves %s instead of reporting a history conflict',
  async (_label, error) => {
    await expect(
      repositoryFailingDeletion(error).remove('tenant-a', 'other-user'),
    ).rejects.toBe(error);
  },
);
